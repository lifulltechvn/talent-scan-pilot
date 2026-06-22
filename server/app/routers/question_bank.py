"""Interview Question Bank — AI generates per skill/level/category, cached for reuse."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.bedrock import invoke_claude
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/question-bank", tags=["question-bank"])

CATEGORIES = ["programming", "architecture", "technical", "security", "soft_skills"]


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
    skills_to_generate = {}  # {category: [skills needing generation]}

    for category in CATEGORIES:
        result[category] = []
        for skill in skills:
            skill_lower = skill.lower().strip()
            # Check cache
            cached = await db.execute(text("""
                SELECT question, answer, trap FROM question_cache
                WHERE skill = :skill AND level = :level AND category = :cat
                LIMIT 1
            """), {"skill": skill_lower, "level": level, "cat": category})
            row = cached.mappings().first()
            if row:
                result[category].append({"skill": skill, "question": row["question"], "answer": row["answer"], "trap": row["trap"]})
            else:
                skills_to_generate.setdefault(category, []).append(skill)

        # If we have 5+ already, trim
        if len(result[category]) >= 5:
            result[category] = result[category][:5]

    # Generate missing questions
    for category, missing_skills in skills_to_generate.items():
        if len(result[category]) >= 5:
            continue  # Already have enough

        needed = 5 - len(result[category])
        skills_for_prompt = missing_skills[:needed]

        prompt = f"""Generate {len(skills_for_prompt)} interview questions for a {level}-level developer.
Category: {category}
Skills to cover: {', '.join(skills_for_prompt)}

For each question provide:
- question: the interview question (1-2 sentences)
- answer: the correct/expected answer (2-3 sentences, specific)
- trap: red flag if candidate doesn't know (1 sentence)

Reply ONLY valid JSON array:
[{{"skill": "...", "question": "...", "answer": "...", "trap": "..."}}]"""

        try:
            raw = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=600, feature="question_bank", candidate_id=candidate_id)
            # Parse
            import re
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned)
            questions = json.loads(cleaned)

            for q in questions:
                skill_lower = q.get("skill", skills_for_prompt[0]).lower().strip()
                # Save to cache
                await db.execute(text("""
                    INSERT INTO question_cache (skill, level, category, question, answer, trap)
                    VALUES (:skill, :level, :cat, :question, :answer, :trap)
                """), {"skill": skill_lower, "level": level, "cat": category, "question": q["question"], "answer": q["answer"], "trap": q["trap"]})

                result[category].append({"skill": q.get("skill", skill_lower), "question": q["question"], "answer": q["answer"], "trap": q["trap"]})

            await db.commit()
        except Exception as e:
            logger.warning(f"Question generation failed for {category}/{missing_skills}: {e}")

        # Trim to 5
        result[category] = result[category][:5]

    return {
        "candidate_id": candidate_id,
        "candidate_name": d.get("name", "Unknown"),
        "level": level,
        "skills": skills,
        "categories": result,
    }
