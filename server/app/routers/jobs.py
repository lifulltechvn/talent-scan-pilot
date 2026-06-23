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
    from app.prompts import JD_IMPORT_PROMPT
    from app.injection_guard import sanitize_for_llm

    clean_text = sanitize_for_llm(text[:3000], "JD_CONTENT")
    prompt = JD_IMPORT_PROMPT.format(text=clean_text)

    try:
        raw = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=500, feature="jd_import")
        # Extract JSON from response
        start = raw.find("{")
        end = raw.rfind("}") + 1
        parsed = json.loads(raw[start:end])
        return parsed
    except Exception as e:
        raise HTTPException(500, f"AI parsing failed: {e}")


@router.post("/generate-jd")
async def generate_job_description(
    data: dict,
    _user: User = Depends(get_current_user),
):
    """Generate a full JD from title + optional keywords + category skill map using AI."""
    from app.bedrock import invoke_claude
    from app.config import settings
    from app.skill_maps import get_skill_map_context

    title = data.get("title", "")
    keywords = data.get("keywords", "")
    category = data.get("category", "")
    if not title:
        raise HTTPException(400, "Title is required")

    from app.prompts import JD_GENERATE_PROMPT

    context_parts = []
    if keywords:
        context_parts.append(f"Additional context/keywords: {keywords}")
    if category:
        skill_map = get_skill_map_context(category)
        if skill_map:
            context_parts.append(f"Company skill map reference for this position:{skill_map}")
    context = "\n".join(context_parts)
    prompt = JD_GENERATE_PROMPT.format(title=title, context=context)

    try:
        raw = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=500, feature="jd_generate")
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {e}")


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


@router.delete("/{job_id}/candidates/{candidate_id}")
async def remove_candidate_from_job(
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove a candidate from a job. Resets to suggested state."""
    from sqlalchemy import text
    await db.execute(text("UPDATE job_candidates SET status = 'suggested' WHERE job_id = :jid AND candidate_id = :cid"), {"jid": str(job_id), "cid": str(candidate_id)})
    await db.execute(text("UPDATE candidates SET status = 'reviewed', job_id = NULL WHERE id = :cid"), {"cid": str(candidate_id)})
    await db.commit()
    return {"status": "removed"}


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
        WHERE jc.job_id = :jid
          AND jc.status NOT IN ('removed', 'rejected', 'assigned', 'scored')
          AND c.status IN ('reviewed', 'rejected')
          AND jc.combined_score >= 0
        ORDER BY jc.combined_score DESC
        LIMIT 10
    """), {"jid": str(job_id)})
    candidates = rows.mappings().all()

    # Get rejection history for each candidate (from other jobs)
    candidate_ids = [str(c["candidate_id"]) for c in candidates]
    rejection_map: dict = {}
    if candidate_ids:
        rej_rows = await db.execute(text("""
            SELECT jc.candidate_id, j.title AS job_title
            FROM job_candidates jc
            JOIN jobs j ON j.id = jc.job_id
            WHERE jc.candidate_id = ANY(:cids)
              AND jc.job_id != :jid
              AND (
                jc.status = 'rejected'
                OR EXISTS (
                  SELECT 1 FROM interviews i WHERE i.candidate_id = jc.candidate_id AND i.job_id = jc.job_id AND i.feedback_decision IN ('fail', 'rejected')
                )
              )
        """), {"cids": candidate_ids, "jid": str(job_id)})
        for r in rej_rows.mappings().all():
            cid = str(r["candidate_id"])
            rejection_map.setdefault(cid, []).append(r["job_title"])

    job_skills = {s.lower() for s in job.required_skills}
    results = []
    for c in candidates:
        cand_skills = {s.lower() for s in (c["structured_data"].get("skills") or [])}
        matched = sorted(job_skills & cand_skills)
        cid = str(c["candidate_id"])
        results.append({
            "id": cid,
            "name": c["structured_data"].get("name", "Unknown"),
            "skills": c["structured_data"].get("skills", []),
            "experience_years": c["structured_data"].get("experience_years", 0),
            "similarity_score": round(float(c["similarity_score"]), 4),
            "skill_score": round(float(c["skill_score"]), 4),
            "combined_score": round(float(c["combined_score"]), 4),
            "matched_skills": matched,
            "status": c["jc_status"],
            "created_at": str(c["created_at"]),
            "rejected_from": rejection_map.get(cid),
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
    candidate.status = "assigned"
    # Invalidate AI recommend cache for this job
    await db.execute(text("DELETE FROM master_config WHERE key = :k"), {"k": f"ai_recommend_{job_id}"})
    await db.commit()

    # Run full scoring (skip LLM if score already exists for this candidate)
    try:
        from app.services.matching import compute_match_score
        from app.services.scoring import compute_rule_score

        # Check cached score
        existing_score = await db.execute(select(Score).where(Score.candidate_id == candidate_id))
        cached = existing_score.scalar_one_or_none()

        if cached and cached.details:
            # Reuse cached score — no LLM call needed
            candidate.match_score = cached.details.get("matching", {}).get("combined_score", 0)
            await db.execute(text("""
                UPDATE job_candidates SET status = 'scored', final_score = :fs, classification = :cl,
                    details = :det
                WHERE job_id = :jid AND candidate_id = :cid
            """), {
                "fs": cached.final_score, "cl": cached.classification,
                "det": json.dumps(cached.details) if cached.details else '{}',
                "jid": str(job_id), "cid": str(candidate_id),
            })
            await db.commit()
            return {
                "candidate_id": str(candidate.id),
                "job_id": str(job_id),
                "match_score": candidate.match_score,
                "final_score": cached.final_score,
                "classification": cached.classification,
                "details": cached.details,
                "cached": True,
            }

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


@router.get("/{job_id}/compare")
async def compare_top_candidates(
    job_id: uuid.UUID,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Compare top scored candidates for a job side-by-side."""
    from sqlalchemy import text

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    rows = await db.execute(text("""
        SELECT jc.candidate_id, jc.final_score, jc.classification, jc.skill_score, jc.similarity_score,
               jc.details, c.structured_data
        FROM job_candidates jc
        JOIN candidates c ON c.id = jc.candidate_id
        WHERE jc.job_id = :jid AND jc.final_score IS NOT NULL
        ORDER BY jc.final_score DESC
        LIMIT :lim
    """), {"jid": str(job_id), "lim": limit})

    candidates = []
    for r in rows.mappings().all():
        sd = r["structured_data"]
        details = r["details"] or {}
        rule = details.get("rule_scoring", {})
        candidates.append({
            "id": str(r["candidate_id"]),
            "name": sd.get("name", "Unknown"),
            "final_score": r["final_score"],
            "classification": r["classification"],
            "skills": sd.get("skills", []),
            "experience_years": sd.get("experience_years", 0),
            "education_level": sd.get("education_level", ""),
            "expected_salary": sd.get("expectedSalary", ""),
            "skill_score": round(float(r["skill_score"]) * 100, 1),
            "similarity_score": round(float(r["similarity_score"]) * 100, 1),
            "rule_breakdown": {
                "skills": rule.get("skills", {}).get("score", 0),
                "experience": rule.get("experience", {}).get("score", 0),
                "education": rule.get("education", {}).get("score", 0),
                "language": rule.get("language", {}).get("score", 0),
            },
            "matched_skills": rule.get("skills", {}).get("matched", []),
            "missing_skills": rule.get("skills", {}).get("missing", []),
            "llm_summary": details.get("llm_summary", ""),
        })

    return {"job_title": job.title, "required_skills": job.required_skills, "candidates": candidates}


@router.get("/{job_id}/ai-recommend")
async def ai_recommend_candidates(
    job_id: uuid.UUID,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI recommends which candidates to interview with detailed reasoning."""
    from app.bedrock import invoke_claude
    from app.config import settings
    from sqlalchemy import text
    import re as _re

    # Check cache
    if not force:
        cache_row = await db.execute(text("SELECT value FROM master_config WHERE key = :k"), {"k": f"ai_recommend_{job_id}"})
        cached = cache_row.scalar()
        if cached:
            return json.loads(cached)

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    rows = await db.execute(text("""
        SELECT jc.final_score, jc.classification, jc.candidate_id, c.structured_data
        FROM job_candidates jc
        JOIN candidates c ON c.id = jc.candidate_id
        WHERE jc.job_id = :jid AND jc.final_score IS NOT NULL
        ORDER BY jc.final_score DESC LIMIT 10
    """), {"jid": str(job_id)})
    candidates = rows.mappings().all()

    if not candidates:
        return {"recommendation": None, "rankings": [], "total_candidates": 0}

    # Get interview feedback if available
    cand_ids = [str(c["candidate_id"]) for c in candidates]
    fb_rows = await db.execute(text("""
        SELECT i.candidate_id, ii.score, ii.notes, u.full_name
        FROM interview_interviewers ii
        JOIN interviews i ON i.id = ii.interview_id
        JOIN users u ON u.id = ii.user_id
        WHERE i.candidate_id::text = ANY(:cids) AND ii.score IS NOT NULL
    """), {"cids": cand_ids})
    feedback_map: dict = {}
    for fb in fb_rows.mappings().all():
        feedback_map.setdefault(str(fb["candidate_id"]), []).append(f"{fb['full_name']}: {fb['score']}/10 - {fb['notes'] or ''}")

    # Build detailed context
    job_skills_set = set(s.lower() for s in (job.required_skills or []))
    cand_details = []
    for i, c in enumerate(candidates):
        sd = c["structured_data"]
        cand_skills = set(s.lower() for s in (sd.get("skills") or []))
        matched = sorted(job_skills_set & cand_skills)
        missing = sorted(job_skills_set - cand_skills)
        feedback = feedback_map.get(str(c["candidate_id"]), [])
        cand_details.append(
            f"{i+1}. {sd.get('name','?')} | Score: {c['final_score']} ({c['classification']})\n"
            f"   Skills matched: {', '.join(matched) or 'none'}\n"
            f"   Skills missing: {', '.join(missing) or 'none'}\n"
            f"   Experience: {sd.get('experience_years',0)}y | Latest: {sd.get('experience',[{}])[0].get('role','')} at {sd.get('experience',[{}])[0].get('company','')}\n"
            f"   Interview feedback: {'; '.join(feedback) if feedback else 'Not interviewed yet'}"
        )

    prompt = f"""You are a senior HR advisor. Analyze these candidates for the position: {job.title}
Required skills: {', '.join(job.required_skills or [])}

Candidates (ranked by score):
{chr(10).join(cand_details)}

Provide:
1. Top 3 ranking with specific reasons (why #1 is better than #2)
2. Action for each: "invite_now" / "consider" / "pass" / "need_more_info"
3. Overall summary (1-2 sentences)

Reply ONLY valid JSON:
{{"summary": "...", "rankings": [{{"rank": 1, "name": "...", "action": "...", "reason": "...", "strengths": ["..."], "concerns": ["..."]}}]}}"""

    try:
        raw = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=800, feature="recommendation")
        cleaned = _re.sub(r'^```(?:json)?\s*', '', raw.strip())
        cleaned = _re.sub(r'\s*```$', '', cleaned)
        cleaned = _re.sub(r',\s*}', '}', cleaned)
        cleaned = _re.sub(r',\s*]', ']', cleaned)
        data = json.loads(cleaned)
        response = {"total_candidates": len(candidates), **data}
        # Cache result
        await db.execute(text("INSERT INTO master_config (key, value) VALUES (:k, :v) ON CONFLICT (key) DO UPDATE SET value = :v"),
            {"k": f"ai_recommend_{job_id}", "v": json.dumps(response)})
        await db.commit()
        return response
    except Exception as e:
        return {"summary": f"AI unavailable: {str(e)[:100]}", "rankings": [], "total_candidates": len(candidates)}
