import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Quiz, User
from app.schemas import CandidateCreate, CandidateRead
from app.services.cv_upload import CV_UPLOAD_DIR

router = APIRouter(prefix="/candidates", tags=["candidates"])

# Thresholds for auto-triggering quiz
QUIZ_LOW_SCORE_THRESHOLD = 50  # final_score < 50 → insufficient_data
QUIZ_AI_CV_LLM_GAP = 30  # rule_score - llm_score > 30 → suspected_ai_cv
QUIZ_DEADLINE_HOURS = 48


async def _auto_trigger_quiz(candidate_id: uuid.UUID, job_id: uuid.UUID, reason: str, db: AsyncSession):
    """Auto-generate a quiz for the candidate."""
    from app.routers.quiz import _generate_questions
    from app.models import Job, QuizQuestion

    candidate = await db.get(Candidate, candidate_id)
    job = await db.get(Job, job_id) if job_id else None

    token = secrets.token_urlsafe(32)
    deadline = datetime.now(timezone.utc) + timedelta(hours=QUIZ_DEADLINE_HOURS)

    quiz = Quiz(
        candidate_id=candidate_id,
        job_id=job_id,
        token=token,
        reason=reason,
        deadline=deadline,
    )
    db.add(quiz)
    await db.flush()

    skills = candidate.structured_data.get("skills", [])
    experience = candidate.structured_data.get("experience", [])
    job_title = job.title if job else "the position"

    questions = _generate_questions(skills, experience, job_title, reason)
    for i, q in enumerate(questions):
        db.add(QuizQuestion(
            quiz_id=quiz.id,
            question_type=q["type"],
            question=q["question"],
            options=q.get("options"),
            purpose=q["purpose"],
            eval_criteria=q["eval_criteria"],
            sort_order=i,
        ))


@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    candidate = Candidate(**data.model_dump())
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    # Auto-score if job_id provided
    if candidate.job_id:
        try:
            from app.models import Job, Score
            from app.services.matching import compute_match_score, get_embedding
            from app.services.scoring import compute_rule_score

            result = await db.execute(select(Job).where(Job.id == candidate.job_id))
            job = result.scalar_one_or_none()
            if job:
                job_embedding = job.embedding
                cand_embedding = candidate.embedding

                cand_skills = candidate.structured_data.get("skills", [])
                match_result = compute_match_score(job_embedding, cand_embedding, job.required_skills, cand_skills)
                score_result = compute_rule_score(
                    job_skills=job.required_skills,
                    candidate_data=candidate.structured_data,
                    job_title=job.title,
                )

                candidate.match_score = match_result["combined_score"]
                score_obj = Score(
                    candidate_id=candidate.id,
                    rule_score=score_result["rule_score"],
                    llm_score=score_result["llm_score"],
                    final_score=score_result["final_score"],
                    classification=score_result["classification"],
                    details={"matching": match_result, "rule_scoring": score_result["details"], "llm_score": score_result["llm_score"], "llm_summary": score_result.get("llm_summary", "")},
                )
                db.add(score_obj)

                # Auto-trigger quiz if needed
                final = score_result["final_score"]
                rule = score_result["rule_score"]
                llm = score_result["llm_score"]

                if final < QUIZ_LOW_SCORE_THRESHOLD:
                    await _auto_trigger_quiz(candidate.id, candidate.job_id, "insufficient_data", db)
                elif rule - llm > QUIZ_AI_CV_LLM_GAP:
                    await _auto_trigger_quiz(candidate.id, candidate.job_id, "suspected_ai_cv", db)

                await db.commit()
                await db.refresh(candidate)
        except Exception:
            pass

    return candidate


@router.get("")
async def list_candidates(
    job_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Search by name or skills"),
    classification: Optional[str] = Query(None, description="gold/silver/talent_pool"),
    min_score: Optional[float] = Query(None),
    max_score: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Candidate).where(Candidate.status != "processing").order_by(Candidate.created_at.desc())
    if job_id:
        q = q.where(Candidate.job_id == job_id)
    if status_filter:
        q = q.where(Candidate.status == status_filter)
    if search:
        search_like = f"%{search.lower()}%"
        q = q.where(
            Candidate.structured_data["name"].astext.ilike(search_like)
            | Candidate.structured_data["skills"].astext.ilike(search_like)
        )
    if classification:
        from app.models import Score
        q = q.join(Score, Score.candidate_id == Candidate.id).where(Score.classification == classification)
    if min_score is not None:
        from app.models import Score
        if "score" not in str(q):
            q = q.join(Score, Score.candidate_id == Candidate.id)
        q = q.where(Score.final_score >= min_score)
    if max_score is not None:
        from app.models import Score
        if "score" not in str(q):
            q = q.join(Score, Score.candidate_id == Candidate.id)
        q = q.where(Score.final_score <= max_score)

    # Pagination
    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)

    result = await db.execute(q)
    candidates = result.scalars().all()

    # Attach quiz_status
    out = []
    for c in candidates:
        quiz_q = await db.execute(
            select(Quiz).where(Quiz.candidate_id == c.id).order_by(Quiz.created_at.desc()).limit(1)
        )
        quiz = quiz_q.scalar_one_or_none()

        out.append({
            "id": c.id, "job_id": c.job_id, "structured_data": c.structured_data,
            "status": c.status, "match_score": c.match_score,
            "source_app_version": c.source_app_version, "scanned_at": c.scanned_at,
            "created_at": c.created_at,
            "quiz_status": quiz.status if quiz else None,  # pending / submitted / evaluated / expired
            "quiz_reason": quiz.reason if quiz else None,
        })
    return out


@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    quiz_q = await db.execute(
        select(Quiz).where(Quiz.candidate_id == candidate_id).order_by(Quiz.created_at.desc()).limit(1)
    )
    quiz = quiz_q.scalar_one_or_none()

    # Count matched jobs from Smart Pool
    from sqlalchemy import text as sa_text
    mc = await db.execute(sa_text("SELECT COUNT(*) FROM job_candidates WHERE candidate_id = :cid"), {"cid": str(candidate_id)})
    matched_jobs_count = mc.scalar() or 0

    return {
        "id": candidate.id, "job_id": candidate.job_id,
        "structured_data": candidate.structured_data,
        "status": candidate.status, "match_score": candidate.match_score,
        "cv_file_path": candidate.cv_file_path,
        "source_app_version": candidate.source_app_version,
        "scanned_at": candidate.scanned_at, "created_at": candidate.created_at,
        "quiz_status": quiz.status if quiz else None,
        "quiz_reason": quiz.reason if quiz else None,
        "matched_jobs_count": matched_jobs_count,
    }


@router.get("/{candidate_id}/matched-jobs")
async def get_candidate_matched_jobs(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all jobs this candidate matches, ordered by combined_score."""
    from sqlalchemy import text

    rows = await db.execute(text("""
        SELECT jc.job_id, jc.similarity_score, jc.skill_score, jc.combined_score,
               jc.status, jc.final_score, jc.classification, jc.matched_at, jc.details,
               j.title, j.required_skills, j.location
        FROM job_candidates jc
        JOIN jobs j ON j.id = jc.job_id
        WHERE jc.candidate_id = :cid
        ORDER BY jc.combined_score DESC
    """), {"cid": str(candidate_id)})

    # Also fetch candidate skills for matched_skills computation
    cand = await db.execute(text("SELECT structured_data FROM candidates WHERE id = :cid"), {"cid": str(candidate_id)})
    cand_row = cand.mappings().first()
    cand_skills = [s.lower() for s in (cand_row["structured_data"].get("skills", []) if cand_row else [])]

    results = []
    for r in rows.mappings().all():
        req_skills = r["required_skills"] or []
        matched = [s for s in req_skills if s.lower() in cand_skills]
        results.append({
            "job_id": str(r["job_id"]),
            "title": r["title"],
            "location": r["location"],
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
            "matched_at": str(r["matched_at"]),
        })
    return results


@router.get("/{candidate_id}/avatar")
async def get_candidate_avatar(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get candidate's avatar extracted from CV."""
    import os
    from fastapi.responses import FileResponse
    avatar_path = os.path.join("/app/uploads/avatars", f"{candidate_id}.jpg")
    if not os.path.exists(avatar_path):
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(avatar_path, media_type="image/jpeg")


@router.get("/{candidate_id}/cv")
async def download_candidate_cv(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download the original CV file for a candidate."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if not candidate.cv_file_path:
        raise HTTPException(status_code=404, detail="CV file not available")

    import os
    file_path = os.path.join(CV_UPLOAD_DIR, candidate.cv_file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="CV file not found on disk")

    # Determine original filename from structured_data or use stored name
    original_name = candidate.structured_data.get("name", candidate.cv_file_path) if candidate.status == "processing" else None
    filename = original_name if original_name and "." in original_name else candidate.cv_file_path

    return FileResponse(file_path, filename=filename, media_type="application/octet-stream")


@router.patch("/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: uuid.UUID,
    new_status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    valid = {"new", "reviewed", "approved", "rejected", "talent_pool"}
    if new_status not in valid:
        raise HTTPException(400, f"Status must be one of: {valid}")
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.status = new_status
    await db.commit()
    return {"id": candidate.id, "status": new_status}


@router.post("/{candidate_id}/notes")
async def add_note(
    candidate_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a note/comment to a candidate."""
    from app.models import AuditLog
    note_text = body.get("text", "").strip()
    if not note_text:
        raise HTTPException(400, "Note text is required")

    log = AuditLog(
        user_id=user.id,
        action="note_added",
        entity_type="candidate",
        entity_id=str(candidate_id),
        details={"text": note_text, "author": user.full_name},
    )
    db.add(log)
    await db.commit()
    return {"id": str(log.id), "text": note_text, "author": user.full_name, "created_at": log.created_at}


@router.get("/{candidate_id}/notes")
async def get_notes(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all notes for a candidate."""
    from app.models import AuditLog
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "candidate",
            AuditLog.entity_id == str(candidate_id),
            AuditLog.action == "note_added",
        ).order_by(AuditLog.created_at.desc())
    )
    notes = result.scalars().all()
    return [
        {"id": str(n.id), "text": n.details.get("text", ""), "author": n.details.get("author", ""), "created_at": n.created_at}
        for n in notes
    ]
