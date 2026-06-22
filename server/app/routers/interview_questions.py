"""Interview Questions API — generate, translate, score."""
import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/interviews", tags=["interview-questions"])


@router.get("/{interview_id}/questions")
async def get_questions(
    interview_id: UUID,
    locale: str = "en",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get question set for an interview. Auto-generates if not exists."""
    # Get interview + job info
    row = await db.execute(text("""
        SELECT i.id, i.candidate_id, i.job_id, i.round, i.question_set_id,
               j.title as job_title, j.required_skills as job_skills, j.category as job_category,
               c.structured_data->>'experience_years' as exp_years
        FROM interviews i
        LEFT JOIN jobs j ON j.id = i.job_id
        LEFT JOIN candidates c ON c.id = i.candidate_id
        WHERE i.id = :id
    """), {"id": str(interview_id)})
    interview = row.mappings().first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    # If already has a question set linked, return it
    if interview["question_set_id"]:
        from app.services.smart_questions import ensure_translation, _get_localized
        qs_row = await db.execute(text("SELECT id, questions_en, translations FROM interview_question_sets WHERE id = :id"), {"id": str(interview["question_set_id"])})
        qs = qs_row.mappings().first()
        if qs:
            if locale != "en":
                translations = qs["translations"] if isinstance(qs["translations"], dict) else json.loads(qs["translations"] or "{}")
                if locale not in translations:
                    await ensure_translation(db, str(qs["id"]), locale)
                    qs_row = await db.execute(text("SELECT id, questions_en, translations FROM interview_question_sets WHERE id = :id"), {"id": str(qs["id"])})
                    qs = qs_row.mappings().first()
            questions = _get_localized(qs, locale)
            return {"question_set_id": str(qs["id"]), "questions": questions, "locale": locale, "cached": True}

    # No job → can't generate
    if not interview["job_id"]:
        return {"question_set_id": None, "questions": [], "locale": locale, "cached": False, "error": "No job linked"}

    # Generate or reuse
    from app.services.smart_questions import get_or_create_question_set
    exp = int(interview["exp_years"] or 0) if interview["exp_years"] else 0
    result = await get_or_create_question_set(
        db, str(interview["job_id"]), interview["job_skills"] or [],
        interview["job_title"] or "", interview["round"] or 1, exp, locale, interview["job_category"]
    )
    if not result:
        raise HTTPException(500, "Failed to generate questions")

    # Link set to interview
    await db.execute(text("UPDATE interviews SET question_set_id = :qid WHERE id = :id"), {"qid": result["id"], "id": str(interview_id)})
    await db.commit()

    return {"question_set_id": result["id"], **{k: v for k, v in result.items() if k != "id"}}


@router.post("/{interview_id}/questions/generate")
async def force_generate(
    interview_id: UUID,
    locale: str = "en",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Force generate a new question set (override cache)."""
    row = await db.execute(text("""
        SELECT i.id, i.job_id, i.round,
               j.title as job_title, j.required_skills as job_skills,
               c.structured_data->>'experience_years' as exp_years
        FROM interviews i
        LEFT JOIN jobs j ON j.id = i.job_id
        LEFT JOIN candidates c ON c.id = i.candidate_id
        WHERE i.id = :id
    """), {"id": str(interview_id)})
    interview = row.mappings().first()
    if not interview or not interview["job_id"]:
        raise HTTPException(400, "Interview has no job linked")

    from app.services.smart_questions import _generate_questions, _translate_questions, _classify_level
    exp = int(interview["exp_years"] or 0) if interview["exp_years"] else 0
    level = _classify_level(exp)

    questions_en = await _generate_questions(interview["job_skills"] or [], interview["job_title"] or "", level, interview["round"] or 1)
    if not questions_en:
        raise HTTPException(500, "Generation failed")

    translations = {}
    if locale != "en":
        translated = await _translate_questions(questions_en, locale)
        if translated:
            translations[locale] = translated

    result = await db.execute(text("""
        INSERT INTO interview_question_sets (job_id, round, level, num_questions, questions_en, translations, is_template, created_by)
        VALUES (:jid, :r, :l, :n, :q, :t, false, :uid) RETURNING id
    """), {"jid": str(interview["job_id"]), "r": interview["round"], "l": level, "n": len(questions_en), "q": json.dumps(questions_en), "t": json.dumps(translations), "uid": str(user.id)})
    set_id = str(result.scalar())
    await db.execute(text("UPDATE interviews SET question_set_id = :qid WHERE id = :id"), {"qid": set_id, "id": str(interview_id)})
    await db.commit()

    return {"question_set_id": set_id, "questions": translations.get(locale, questions_en), "locale": locale, "cached": False}


class ScoreSubmit(BaseModel):
    scores: list  # [{"question_id": 1, "checked": [true,true,false,false,true], "score": 3}]
    custom_questions: list = []


@router.post("/{interview_id}/questions/score")
async def submit_score(
    interview_id: UUID,
    body: ScoreSubmit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit question scores."""
    # Get question_set_id from interview
    row = await db.execute(text("SELECT question_set_id FROM interviews WHERE id = :id"), {"id": str(interview_id)})
    interview = row.mappings().first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    total = sum(s.get("score", 0) for s in body.scores)
    max_score = sum(5 for _ in body.scores)  # 5 per question
    pct = round((total / max_score * 100), 2) if max_score > 0 else 0

    # Assess G-level from criteria
    g_assessment = None
    if interview["question_set_id"]:
        qs_row = await db.execute(text("SELECT questions_en FROM interview_question_sets WHERE id = :id"), {"id": str(interview["question_set_id"])})
        qs_data = qs_row.mappings().first()
        if qs_data:
            questions_en = qs_data["questions_en"] if isinstance(qs_data["questions_en"], list) else json.loads(qs_data["questions_en"])
            from app.services.smart_questions import assess_g_level
            g_assessment = assess_g_level(questions_en, body.scores)

    # Upsert score
    await db.execute(text("""
        INSERT INTO interview_question_scores (interview_id, question_set_id, scores, custom_questions, total_score, max_score, percentage, submitted_at)
        VALUES (:iid, :qid, :scores, :custom, :total, :max, :pct, now())
        ON CONFLICT (interview_id) DO UPDATE SET
            scores = :scores, custom_questions = :custom, total_score = :total, max_score = :max, percentage = :pct, submitted_at = now()
    """), {
        "iid": str(interview_id), "qid": interview["question_set_id"],
        "scores": json.dumps(body.scores), "custom": json.dumps(body.custom_questions),
        "total": total, "max": max_score, "pct": pct,
    })
    await db.commit()
    return {"total_score": total, "max_score": max_score, "percentage": pct, "g_assessment": g_assessment}


@router.get("/{interview_id}/questions/score")
async def get_score(
    interview_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get submitted question scores."""
    row = await db.execute(text("""
        SELECT * FROM interview_question_scores WHERE interview_id = :id
    """), {"id": str(interview_id)})
    score = row.mappings().first()
    if not score:
        return None
    return {
        "scores": score["scores"],
        "custom_questions": score["custom_questions"],
        "total_score": float(score["total_score"]) if score["total_score"] else 0,
        "max_score": float(score["max_score"]) if score["max_score"] else 0,
        "percentage": float(score["percentage"]) if score["percentage"] else 0,
        "submitted_at": str(score["submitted_at"]) if score["submitted_at"] else None,
    }
