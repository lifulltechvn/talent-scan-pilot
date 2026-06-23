"""Interview Question Bank — cached questions per skill/level/category."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/question-bank", tags=["question-bank"])

CATEGORIES = ["programming", "system_design", "tech_stack", "testing", "security", "devops", "problem_solving", "soft_skills"]


def _determine_level(exp_years: int) -> str:
    if exp_years <= 1:
        return "junior"
    elif exp_years <= 4:
        return "mid"
    return "senior"


@router.get("/for-candidate/{candidate_id}")
async def get_questions_for_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get interview questions for a candidate. Uses cache, generates only missing ones."""
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    d = candidate.structured_data or {}
    skills = d.get("skills", [])[:6]  # Top 6 skills
    exp_years = d.get("experience_years", 0)
    level = _determine_level(exp_years)

    if not skills:
        raise HTTPException(400, "Candidate has no skills parsed")

    result = {}

    for category in CATEGORIES:
        result[category] = []
        # First: get ALL cached questions matching any of candidate's skills for this category
        skills_lower = [s.lower().strip() for s in skills]
        cached_all = await db.execute(text("""
            SELECT question, answer, trap, skill FROM question_cache
            WHERE skill = ANY(:skills) AND level = :level AND category = :cat
            LIMIT 5
        """), {"skills": skills_lower, "level": level, "cat": category})
        for row in cached_all.mappings().all():
            result[category].append({"skill": row["skill"], "question": row["question"], "answer": row["answer"], "trap": row["trap"]})

        if len(result[category]) < 5:
            # Fallback: get any questions for this category + level to fill up
            if result[category]:
                existing_ids = [r["question"][:50] for r in result[category]]
            else:
                existing_ids = []
            fill = await db.execute(text("""
                SELECT question, answer, trap, skill FROM question_cache
                WHERE level = :level AND category = :cat
                ORDER BY RANDOM() LIMIT :n
            """), {"level": level, "cat": category, "n": 5 - len(result[category])})
            for row in fill.mappings().all():
                if row["question"][:50] not in existing_ids:
                    result[category].append({"skill": row["skill"], "question": row["question"], "answer": row["answer"], "trap": row["trap"]})

        # Trim to 5
        result[category] = result[category][:5]

    return {
        "candidate_id": candidate_id,
        "candidate_name": d.get("name", "Unknown"),
        "level": level,
        "skills": skills,
        "categories": result,
    }
