import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Quiz, User
from app.schemas import CandidateCreate, CandidateRead

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
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Candidate).order_by(Candidate.created_at.desc())
    if job_id:
        q = q.where(Candidate.job_id == job_id)
    if status_filter:
        q = q.where(Candidate.status == status_filter)
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

    return {
        "id": candidate.id, "job_id": candidate.job_id,
        "structured_data": candidate.structured_data,
        "status": candidate.status, "match_score": candidate.match_score,
        "source_app_version": candidate.source_app_version,
        "scanned_at": candidate.scanned_at, "created_at": candidate.created_at,
        "quiz_status": quiz.status if quiz else None,
        "quiz_reason": quiz.reason if quiz else None,
    }


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
