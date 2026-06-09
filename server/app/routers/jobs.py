import json
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, Score, User
from app.schemas import JobCreate, JobRead, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/import")
async def import_jd_file(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
):
    """Upload a JD file (PDF/DOCX), extract text, parse with AI into structured job data."""
    from app.extractor import extract
    from app.bedrock import invoke_claude
    from app.config import settings

    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in {".pdf", ".docx", ".doc", ".txt"}:
        raise HTTPException(400, "Supported formats: PDF, DOCX, TXT")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large. Max 5MB.")

    # Extract text
    if ext == ".txt":
        text = content.decode("utf-8", errors="ignore")
    else:
        result = extract(content, file.filename or "file.pdf")
        text = result.text

    if not text.strip():
        raise HTTPException(400, "Could not extract text from file")

    # Parse with AI
    prompt = f"""Parse this job description and extract structured data. Reply in JSON only:
{{
  "title": "job title",
  "description": "2-3 sentence summary",
  "required_skills": ["skill1", "skill2", ...],
  "location": "city or remote",
  "salary_range": "range if mentioned or null",
  "required_years": number or null,
  "required_education": "bachelor/master/phd or null",
  "deadline": "YYYY-MM-DD or null"
}}

JD text:
{text[:3000]}"""

    try:
        raw = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=500, feature="jd_import")
        # Extract JSON from response
        start = raw.find("{")
        end = raw.rfind("}") + 1
        parsed = json.loads(raw[start:end])
        return parsed
    except Exception as e:
        raise HTTPException(500, f"AI parsing failed: {e}")



async def _smart_pool_match_job(job_id: str):
    """Background task: match job against all candidates with embeddings."""
    from app.database import async_session_factory
    from app.services.smart_pool import match_job_to_all_candidates

    async with async_session_factory() as db:
        await match_job_to_all_candidates(job_id, db)


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: JobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = Job(**data.model_dump(), created_by=user.id)

    # Generate JD embedding (non-blocking — skip on failure)
    try:
        from app.services.matching import get_embedding
        embed_text = f"{data.title} {data.description or ''} {' '.join(data.required_skills)}"
        job.embedding = get_embedding(embed_text)
    except Exception:
        pass

    db.add(job)
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(_smart_pool_match_job, str(job.id))
    return job


@router.get("", response_model=list[JobRead])
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/{job_id}", response_model=JobRead)
async def update_job(
    job_id: uuid.UUID,
    data: JobUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(job, k, v)

    # Re-generate embedding on update (skip on failure)
    try:
        from app.services.matching import get_embedding
        embed_text = f"{job.title} {job.description or ''} {' '.join(job.required_skills)}"
        job.embedding = get_embedding(embed_text)
    except Exception:
        pass

    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(_smart_pool_match_job, str(job.id))
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(job)
    await db.commit()


@router.get("/{job_id}/suggest")
async def suggest_candidates(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return top 20 pre-computed matches from job_candidates table."""
    from sqlalchemy import text

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.embedding is None:
        raise HTTPException(status_code=400, detail="Job has no embedding. Update job to generate one.")

    rows = await db.execute(text("""
        SELECT jc.candidate_id, jc.similarity_score, jc.skill_score, jc.combined_score, jc.status AS jc_status,
               c.structured_data, c.status, c.created_at
        FROM job_candidates jc
        JOIN candidates c ON c.id = jc.candidate_id
        WHERE jc.job_id = :jid AND c.status != 'processing' AND c.status != 'approved'
        ORDER BY jc.combined_score DESC
        LIMIT 20
    """), {"jid": str(job_id)})
    candidates = rows.mappings().all()

    job_skills = {s.lower() for s in job.required_skills}
    results = []
    for c in candidates:
        cand_skills = {s.lower() for s in (c["structured_data"].get("skills") or [])}
        matched = sorted(job_skills & cand_skills)
        results.append({
            "id": str(c["candidate_id"]),
            "name": c["structured_data"].get("name", "Unknown"),
            "skills": c["structured_data"].get("skills", []),
            "experience_years": c["structured_data"].get("experience_years", 0),
            "similarity_score": round(float(c["similarity_score"]), 4),
            "skill_score": round(float(c["skill_score"]), 4),
            "combined_score": round(float(c["combined_score"]), 4),
            "matched_skills": matched,
            "status": c["jc_status"],
            "created_at": str(c["created_at"]),
        })
    return results


@router.get("/{job_id}/candidates/{candidate_id}/score-detail")
async def get_candidate_score_detail(
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get detailed scoring breakdown for a candidate-job pair."""
    from sqlalchemy import text

    row = await db.execute(text("""
        SELECT jc.similarity_score, jc.skill_score, jc.combined_score,
               jc.status, jc.final_score, jc.classification, jc.details,
               j.title, j.required_skills,
               c.structured_data
        FROM job_candidates jc
        JOIN jobs j ON j.id = jc.job_id
        JOIN candidates c ON c.id = jc.candidate_id
        WHERE jc.job_id = :jid AND jc.candidate_id = :cid
    """), {"jid": str(job_id), "cid": str(candidate_id)})
    r = row.mappings().first()
    if not r:
        raise HTTPException(status_code=404, detail="No match found")

    req_skills = r["required_skills"] or []
    cand_skills = [s.lower() for s in (r["structured_data"].get("skills", []))]
    matched = [s for s in req_skills if s.lower() in cand_skills]

    return {
        "job_title": r["title"],
        "required_skills": req_skills,
        "matched_skills": matched,
        "missing_skills": [s for s in req_skills if s.lower() not in cand_skills],
        "similarity_score": round(float(r["similarity_score"]), 4),
        "skill_score": round(float(r["skill_score"]), 4),
        "combined_score": round(float(r["combined_score"]), 4),
        "status": r["status"],
        "final_score": r["final_score"],
        "classification": r["classification"],
        "details": r["details"],
        "candidate_skills": r["structured_data"].get("skills", []),
        "candidate_experience_years": r["structured_data"].get("experience_years"),
    }


@router.post("/{job_id}/assign/{candidate_id}")
async def assign_candidate_to_job(
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Assign a candidate to a job and run full scoring."""
    from sqlalchemy import text

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Update job_candidates status to 'assigned'
    await db.execute(text("""
        INSERT INTO job_candidates (id, job_id, candidate_id, status, matched_at)
        VALUES (gen_random_uuid(), :jid, :cid, 'assigned', now())
        ON CONFLICT (job_id, candidate_id) DO UPDATE SET status = 'assigned'
    """), {"jid": str(job_id), "cid": str(candidate_id)})

    # Also set candidate.job_id for backward compatibility
    candidate.job_id = job_id
    await db.commit()

    # Run full scoring
    try:
        from app.services.matching import compute_match_score
        from app.services.scoring import compute_rule_score

        match_result = compute_match_score(
            job.embedding, candidate.embedding, job.required_skills,
            candidate.structured_data.get("skills", []),
        )
        score_result = compute_rule_score(
            job_skills=job.required_skills,
            candidate_data=candidate.structured_data,
            required_years=job.required_years,
            required_education=job.required_education,
            job_title=job.title,
        )

        candidate.match_score = match_result["combined_score"]

        # Remove old score if exists
        from sqlalchemy import delete
        await db.execute(delete(Score).where(Score.candidate_id == candidate_id))

        score_obj = Score(
            candidate_id=candidate.id,
            rule_score=score_result["rule_score"],
            llm_score=score_result["llm_score"],
            final_score=score_result["final_score"],
            classification=score_result["classification"],
            details={
                "matching": match_result,
                "rule_scoring": score_result["details"],
                "llm_score": score_result["llm_score"],
                "llm_summary": score_result.get("llm_summary", ""),
            },
        )
        db.add(score_obj)

        # Update job_candidates with scoring results
        await db.execute(text("""
            UPDATE job_candidates SET status = 'scored', final_score = :fs, classification = :cl,
                details = :det
            WHERE job_id = :jid AND candidate_id = :cid
        """), {
            "fs": score_result["final_score"], "cl": score_result["classification"],
            "det": json.dumps(score_obj.details), "jid": str(job_id), "cid": str(candidate_id),
        })

        await db.commit()
        await db.refresh(candidate)

        return {
            "candidate_id": str(candidate.id),
            "job_id": str(job_id),
            "match_score": match_result["combined_score"],
            "final_score": score_result["final_score"],
            "classification": score_result["classification"],
            "details": score_obj.details,
        }
    except Exception as e:
        await db.commit()
        return {
            "candidate_id": str(candidate.id),
            "job_id": str(job_id),
            "error": str(e),
            "assigned": True,
        }
