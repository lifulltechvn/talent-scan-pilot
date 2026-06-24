"""Question Bank — read cached questions, load answers on demand."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, User

router = APIRouter(prefix="/question-bank", tags=["question-bank"])

CATEGORIES = ["programming", "system_design", "tech_stack", "testing", "security", "devops", "problem_solving", "soft_skills"]


@router.get("/for-candidate/{candidate_id}")
async def get_questions_for_candidate(
    candidate_id: str,
    locale: str = "en",
    job_id: str | None = None,
    round: int = 1,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return cached questions (generated at interview creation time)."""
    cached = await db.execute(text(
        "SELECT id, category, skill, question_en, question_vi FROM question_cache WHERE candidate_id = :cid AND round = :round ORDER BY category, created_at"
    ), {"cid": candidate_id})
    rows = cached.mappings().all()

    if not rows:
        # Trigger generation (same logic as interview creation background task)
        from app.routers.interviews import _pre_generate_question_bank
        import asyncio
        await _pre_generate_question_bank(candidate_id, job_id, round)
        # Re-fetch
        cached = await db.execute(text(
            "SELECT id, category, skill, question_en, question_vi FROM question_cache WHERE candidate_id = :cid AND round = :round ORDER BY category, created_at"
        ), {"cid": candidate_id})
        rows = cached.mappings().all()
        if not rows:
            candidate = await db.get(Candidate, candidate_id)
            name = (candidate.structured_data or {}).get("name", "") if candidate else ""
            return {"candidate_id": candidate_id, "candidate_name": name, "categories": {}}

    result = {}
    for r in rows:
        cat = r["category"]
        if cat not in result:
            result[cat] = []
        q_text = r["question_vi"] if (locale == "vi" and r["question_vi"]) else r["question_en"]
        result[cat].append({"id": str(r["id"]), "question": q_text, "skill": r["skill"]})

    candidate = await db.get(Candidate, candidate_id)
    name = (candidate.structured_data or {}).get("name", "") if candidate else ""
    return {"candidate_id": candidate_id, "candidate_name": name, "categories": result}


@router.get("/answer/{question_id}")
async def get_answer(
    question_id: str,
    locale: str = "en",
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Load answer for a question on demand. Generates + caches if not exists."""
    row = await db.execute(text(
        "SELECT id, question_en, skill, level, answer_en, answer_vi, red_flag_en, red_flag_vi FROM question_cache WHERE id = :id"
    ), {"id": question_id})
    q = row.mappings().first()
    if not q:
        raise HTTPException(404, "Question not found")

    # Return cached
    if locale == "vi" and q["answer_vi"]:
        return {"answer": q["answer_vi"], "red_flag": q["red_flag_vi"] or ""}
    if q["answer_en"]:
        if locale == "vi":
            from app.bedrock import invoke_claude
            from app.config import settings
            try:
                vi = invoke_claude(f"Translate to Vietnamese:\nANSWER: {q['answer_en']}\nRED_FLAG: {q['red_flag_en'] or ''}", model=settings.BEDROCK_MODEL_HAIKU, max_tokens=800, feature="a_translate")
                parts = vi.split("RED_FLAG")
                ans_vi = parts[0].replace("ANSWER:", "").replace("CÂU TRẢ LỜI:", "").strip().lstrip(":").strip()
                rf_vi = parts[1].strip().lstrip(":").strip() if len(parts) > 1 else ""
                await db.execute(text("UPDATE question_cache SET answer_vi = :a, red_flag_vi = :r WHERE id = :id"), {"a": ans_vi, "r": rf_vi, "id": question_id})
                await db.commit()
                return {"answer": ans_vi, "red_flag": rf_vi}
            except Exception:
                return {"answer": q["answer_en"], "red_flag": q["red_flag_en"] or ""}
        return {"answer": q["answer_en"], "red_flag": q["red_flag_en"] or ""}

    # Generate answer
    from app.bedrock import invoke_claude
    from app.config import settings

    prompt = f"""You are interviewing a {q['level']}-level candidate for skill: {q['skill']}.
Question: {q['question_en']}

Provide:
ANSWER: 3-4 bullet points (use "- " prefix), concise key points only, no bold/italic/markdown
RED_FLAG: 1-2 bullet points of weak answer signs (use "- " prefix)"""

    try:
        raw = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=500, feature="answer_gen")
        # Parse ANSWER and RED_FLAG
        parts = raw.split("RED_FLAG")
        answer_en = parts[0].replace("ANSWER:", "").strip().lstrip(":").strip()
        red_flag_en = parts[1].strip().lstrip(":").strip() if len(parts) > 1 else ""
        # Clean markdown artifacts
        answer_en = answer_en.replace("**", "").replace("*", "").replace("##", "").replace("#", "").strip()
        red_flag_en = red_flag_en.replace("**", "").replace("*", "").replace("##", "").replace("#", "").strip()
        await db.execute(text("UPDATE question_cache SET answer_en = :a, red_flag_en = :r WHERE id = :id"), {"a": answer_en, "r": red_flag_en, "id": question_id})
        await db.commit()

        if locale == "vi":
            vi = invoke_claude(f"Translate to Vietnamese (keep format):\nANSWER: {answer_en}\nRED_FLAG: {red_flag_en}", model=settings.BEDROCK_MODEL_HAIKU, max_tokens=800, feature="a_translate")
            vp = vi.split("RED_FLAG")
            ans_vi = vp[0].replace("ANSWER:", "").replace("CÂU TRẢ LỜI:", "").strip().lstrip(":").strip()
            rf_vi = vp[1].strip().lstrip(":").strip() if len(vp) > 1 else ""
            await db.execute(text("UPDATE question_cache SET answer_vi = :a, red_flag_vi = :r WHERE id = :id"), {"a": ans_vi, "r": rf_vi, "id": question_id})
            await db.commit()
            return {"answer": ans_vi, "red_flag": rf_vi}
        return {"answer": answer_en, "red_flag": red_flag_en}
    except Exception as e:
        raise HTTPException(500, f"Failed: {e}")
