"""Question Bank v2 — 3 categories per job, cached by key."""
import json, hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, User, Job

router = APIRouter(prefix="/question-bank", tags=["question-bank"])

CATEGORIES = {
    "problem_solving": "Giải quyết vấn đề",
    "ai_skills": "Kỹ năng sử dụng AI",
    "g_assessment": "Đánh giá G-level",
}


def _get_level(exp_years: int) -> str:
    if exp_years < 1: return "fresher"
    if exp_years < 3: return "junior"
    if exp_years < 7: return "senior"
    return "master"


def _jd_hash(description: str) -> str:
    return hashlib.md5((description or "")[:500].encode()).hexdigest()[:16]


@router.get("/for-candidate/{candidate_id}")
async def get_questions_for_candidate(
    candidate_id: str,
    job_id: str | None = None,
    locale: str = "en",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return cached questions for this candidate's job context."""
    # Find job from candidate or param
    if not job_id:
        row = await db.execute(text("SELECT job_id FROM interviews WHERE candidate_id = :cid ORDER BY created_at DESC LIMIT 1"), {"cid": candidate_id})
        job_id = row.scalar()
    if not job_id:
        return {"candidate_id": candidate_id, "categories": {}, "status": "no_job"}

    # Get all cached questions for this job
    cached = await db.execute(text(
        "SELECT category, cache_key, questions_en, questions_vi FROM question_cache WHERE job_id = :jid"
    ), {"jid": str(job_id)})
    rows = cached.mappings().all()

    result = {}
    for r in rows:
        cat = r["category"]
        qs = r["questions_vi"] if (locale == "vi" and r["questions_vi"]) else r["questions_en"]
        if isinstance(qs, str):
            qs = json.loads(qs)
        result[cat] = {"label": CATEGORIES.get(cat, cat), "questions": qs, "cache_key": r["cache_key"]}

    candidate = await db.get(Candidate, candidate_id)
    name = (candidate.structured_data or {}).get("name", "") if candidate else ""
    return {"candidate_id": candidate_id, "candidate_name": name, "job_id": job_id, "categories": result}


@router.delete("/invalidate/{job_id}")
async def invalidate_job_questions(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Manually invalidate cached questions for a job."""
    await db.execute(text("DELETE FROM question_cache WHERE job_id = :jid"), {"jid": job_id})
    await db.commit()
    return {"status": "invalidated"}
