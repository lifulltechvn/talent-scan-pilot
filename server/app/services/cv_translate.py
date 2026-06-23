"""Background translation for candidate structured_data (EN → VI).
Runs after CV scan completes. Includes retry logic and status tracking."""
import json
import logging
import threading
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.bedrock import invoke_claude
from app.config import settings

logger = logging.getLogger(__name__)

# Translation status stored in structured_data["_i18n_status"]:
# "pending" | "done" | "failed:{reason}"

TRANSLATE_PROMPT = """Translate the following CV fields from English to Vietnamese.
Keep technical terms (company names, tool names, certifications) unchanged.
Return ONLY valid JSON with the translated fields.

Input:
{input_json}

Return JSON with these keys:
{{
  "experience": [{{ "role_vi": "...", "description_vi": "..." }}],
  "education": [{{ "degree_vi": "...", "major_vi": "..." }}],
  "insight": {{ "strengths_vi": "...", "weaknesses_vi": "..." }}
}}

Translate naturally, not word-by-word. Return ONLY JSON, no markdown."""


def translate_candidate_background(candidate_id: str, structured_data: dict, max_retries: int = 3):
    """Fire-and-forget translation. Retries up to max_retries times."""
    def _run():
        for attempt in range(max_retries):
            try:
                result = _do_translate(candidate_id, structured_data)
                if result:
                    _save_translation(candidate_id, structured_data, result)
                    logger.info(f"Translation done for {candidate_id} (attempt {attempt+1})")
                    return
            except Exception as e:
                logger.warning(f"Translation attempt {attempt+1}/{max_retries} failed for {candidate_id}: {e}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2 * (attempt + 1))  # Backoff: 2s, 4s, 6s

        # All retries failed — mark as failed
        _mark_failed(candidate_id, "max_retries_exceeded")

    threading.Thread(target=_run, daemon=True).start()


def _do_translate(candidate_id: str, structured_data: dict) -> dict | None:
    """Call AI to translate fields."""
    # Build input for translation (only translatable fields)
    input_data = {
        "experience": [
            {"role": e.get("role", ""), "description": e.get("description", "")}
            for e in (structured_data.get("experience") or [])[:5]
        ],
        "education": [
            {"degree": e.get("degree", ""), "major": e.get("major", "")}
            for e in (structured_data.get("education") or [])[:3]
        ],
        "insight": {
            "strengths": (structured_data.get("insight") or {}).get("strengths", ""),
            "weaknesses": (structured_data.get("insight") or {}).get("weaknesses", ""),
        }
    }

    # Skip if nothing to translate
    has_content = any(e.get("role") or e.get("description") for e in input_data["experience"])
    has_content = has_content or any(e.get("degree") or e.get("major") for e in input_data["education"])
    has_content = has_content or input_data["insight"].get("strengths") or input_data["insight"].get("weaknesses")
    if not has_content:
        return {"_empty": True}

    prompt = TRANSLATE_PROMPT.format(input_json=json.dumps(input_data, ensure_ascii=False))
    response = invoke_claude(prompt, max_tokens=2000, temperature=0.1, feature="cv_translate")

    # Parse response
    text_resp = response.strip()
    if text_resp.startswith("```"):
        text_resp = text_resp.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text_resp)


def _save_translation(candidate_id: str, structured_data: dict, translation: dict):
    """Save translated fields back to candidate structured_data."""
    async def _do():
        engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sf() as db:
                # Merge translation into structured_data
                sd = dict(structured_data)

                if not translation.get("_empty"):
                    # Merge experience translations
                    for i, exp_t in enumerate(translation.get("experience") or []):
                        if i < len(sd.get("experience") or []):
                            sd["experience"][i]["role_vi"] = exp_t.get("role_vi", "")
                            sd["experience"][i]["description_vi"] = exp_t.get("description_vi", "")

                    # Merge education translations
                    for i, edu_t in enumerate(translation.get("education") or []):
                        if i < len(sd.get("education") or []):
                            sd["education"][i]["degree_vi"] = edu_t.get("degree_vi", "")
                            sd["education"][i]["major_vi"] = edu_t.get("major_vi", "")

                    # Merge insight
                    if "insight" in translation:
                        if "insight" not in sd:
                            sd["insight"] = {}
                        sd["insight"]["strengths_vi"] = translation["insight"].get("strengths_vi", "")
                        sd["insight"]["weaknesses_vi"] = translation["insight"].get("weaknesses_vi", "")

                sd["_i18n_status"] = "done"

                await db.execute(text(
                    "UPDATE candidates SET structured_data = :sd WHERE id = :id"
                ), {"sd": json.dumps(sd, ensure_ascii=False), "id": candidate_id})
                await db.commit()
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_do())
    finally:
        loop.close()


def _mark_failed(candidate_id: str, reason: str):
    """Mark translation as failed for monitoring."""
    async def _do():
        engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sf() as db:
                await db.execute(text("""
                    UPDATE candidates SET structured_data = jsonb_set(
                        structured_data, '{_i18n_status}', :status::jsonb
                    ) WHERE id = :id
                """), {"status": json.dumps(f"failed:{reason}"), "id": candidate_id})
                await db.commit()
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_do())
    finally:
        loop.close()


async def retry_failed_translations(db):
    """Scheduler job: retry candidates with failed translations."""
    result = await db.execute(text("""
        SELECT id, structured_data FROM candidates
        WHERE structured_data->>'_i18n_status' LIKE 'failed:%'
        LIMIT 10
    """))
    for row in result.mappings().all():
        translate_candidate_background(str(row["id"]), row["structured_data"])
    return result.rowcount


async def get_translation_stats(db) -> dict:
    """Monitor: get translation status counts."""
    result = await db.execute(text("""
        SELECT
            count(*) FILTER (WHERE structured_data->>'_i18n_status' = 'done') as done,
            count(*) FILTER (WHERE structured_data->>'_i18n_status' LIKE 'failed:%') as failed,
            count(*) FILTER (WHERE structured_data->>'_i18n_status' IS NULL OR structured_data->>'_i18n_status' = 'pending') as pending
        FROM candidates
    """))
    row = result.mappings().first()
    return {"done": row["done"], "failed": row["failed"], "pending": row["pending"]}
