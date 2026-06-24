"""AI Advanced features: CV Authenticity Check, Interview Coaching, Culture Fit."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.bedrock import invoke_claude
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-advanced", tags=["ai-advanced"])


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Claude response, handling markdown blocks and minor format issues."""
    import re
    cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip())
    cleaned = re.sub(r'\s*```$', '', cleaned)
    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Fix common issues: trailing commas, single quotes
    cleaned = re.sub(r',\s*}', '}', cleaned)
    cleaned = re.sub(r',\s*]', ']', cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Last resort: extract first JSON object
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # Try repair truncated JSON
    repaired = _repair_truncated_json(cleaned)
    if repaired:
        return repaired
    raise ValueError(f"Cannot parse JSON from: {cleaned[:200]}")


def _repair_truncated_json(text: str) -> dict | None:
    """Try to repair truncated JSON by closing brackets."""
    import re
    # Count open/close brackets
    opens = text.count('{') + text.count('[')
    closes = text.count('}') + text.count(']')
    if opens > closes:
        # Add missing closings
        repaired = text.rstrip().rstrip(',')
        for _ in range(opens - closes):
            if repaired.count('[') > repaired.count(']'):
                repaired += '"]'
            else:
                repaired += '}'
        try:
            return json.loads(repaired)
        except Exception:
            pass
    return None


# ============ #1: AI Detect CV giả ============

class AuthenticityResult(BaseModel):
    score: int  # 0-100 (100 = authentic)
    verdict: str  # authentic / suspicious / likely_ai
    reasons: list[str]
    details: dict


@router.post("/cv-authenticity/{candidate_id}")
async def check_cv_authenticity(
    candidate_id: str,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """AI-powered CV authenticity check. Analyzes raw CV text for AI-generated patterns."""
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    # Get raw CV text from file (not parsed data — that's already AI-processed)
    import os
    raw_text = ""
    if candidate.cv_file_path:
        from app.extractor import extract
        file_path = os.path.join("/app/uploads/cv", candidate.cv_file_path)
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                result = extract(f.read(), candidate.cv_file_path)
                raw_text = result.text[:3000]

    if not raw_text:
        raise HTTPException(400, "CV file not available for analysis")

    d = candidate.structured_data or {}
    # Compute concrete signals
    experience = d.get("experience", [])
    signals = []
    # Check description patterns
    descriptions = []
    for e in experience:
        desc = e.get("description", "")
        if isinstance(desc, dict):
            desc = desc.get("en", "") or desc.get("vi", "")
        if desc:
            descriptions.append(desc)
    if descriptions:
        avg_len = sum(len(desc) for desc in descriptions) / len(descriptions)
        if avg_len > 150:
            signals.append(f"Average description length: {avg_len:.0f} chars (AI tends to write longer)")
        # Check if all descriptions have similar structure
        starts = [desc[:20] for desc in descriptions]
        if len(set(starts)) < len(starts) * 0.5:
            signals.append("Descriptions have repetitive structure")
    # Check skill count
    skills = d.get("skills", [])
    if len(skills) > 15:
        signals.append(f"Unusually high skill count: {len(skills)} (may be inflated)")

    prompt = f"""You are an expert CV fraud detector. Analyze this RAW CV text (not AI-parsed) for authenticity.

<RAW_CV_TEXT>
{raw_text}
</RAW_CV_TEXT>

Pre-computed signals: {json.dumps(signals)}

Detect these SPECIFIC patterns of AI-generated or fake CVs:
1. WRITING STYLE: Does it read like ChatGPT? (overly formal, perfect grammar, buzzword-heavy, no personality)
2. SPECIFICITY: Are achievements vague ("improved efficiency") or concrete ("reduced API latency from 200ms to 80ms for 1M daily users")?
3. CONSISTENCY: Do experience years match timeline? Does skill level match claimed experience?
4. REALISM: Are metrics believable? ("Led team of 50" for a 2-year junior dev?)
5. FORMATTING: Human CVs have inconsistencies (typos, mixed formatting). AI-written ones are suspiciously perfect.
6. LANGUAGE NATURALNESS: Real humans write "used Redis for caching" not "leveraged Redis to implement a distributed caching layer"

Reply ONLY valid JSON (reasons, red_flags, green_flags in both Vietnamese and English):
{{"score": <0-100, 100=authentic>, "verdict": "<authentic|suspicious|likely_ai>", "reasons": {{"vi": ["bằng chứng tiếng Việt"], "en": ["evidence in English"]}}, "red_flags": {{"vi": ["dấu hiệu nghi ngờ"], "en": ["suspicious sign"]}}, "green_flags": {{"vi": ["dấu hiệu tốt"], "en": ["good sign"]}}}}"""

    try:
        # Check cached result
        cached = d.get("_ai_authenticity")
        if cached and not force:
            return {"candidate_id": candidate_id, "candidate_name": d.get("name", "Unknown"), **cached}

        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=2000, feature="cv_authenticity", candidate_id=candidate_id)
        logger.info(f"CV authenticity raw response: {result[:200]}")
        data = _parse_json_response(result)
        response = {
            "score": data.get("score", 70),
            "verdict": data.get("verdict", "unknown"),
            "reasons": data.get("reasons", []),
            "red_flags": data.get("red_flags", []),
            "green_flags": data.get("green_flags", []),
        }
        # Cache result
        await db.execute(text("UPDATE candidates SET structured_data = jsonb_set(structured_data, '{_ai_authenticity}', CAST(:val AS jsonb)) WHERE id = :cid"),
            {"val": json.dumps(response), "cid": candidate_id})
        await db.commit()
        return {"candidate_id": candidate_id, "candidate_name": d.get("name", "Unknown"), **response}
    except Exception as e:
        logger.warning(f"CV authenticity check failed: {e}")
        return {"candidate_id": candidate_id, "score": 70, "verdict": "unknown", "reasons": [f"Analysis error: {str(e)[:100]}"], "red_flags": [], "green_flags": []}


# ============ #4: AI Culture Fit ============

@router.post("/culture-fit/{candidate_id}")
async def assess_culture_fit(
    candidate_id: str,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Assess candidate's retention risk and team fit based on concrete CV patterns."""
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    d = candidate.structured_data or {}
    experiences = d.get("experience", [])

    # Compute concrete metrics from CV
    job_count = len(experiences)
    exp_years = d.get("experience_years", 0)
    avg_tenure = round(exp_years / job_count, 1) if job_count > 0 else 0

    # Detect job-hopping: extract durations
    durations = []
    for e in experiences:
        dur = e.get("duration", e.get("years", ""))
        durations.append(str(dur))

    # Get job context if assigned
    job_context = ""
    if candidate.job_id:
        from app.models import Job
        job = await db.get(Job, candidate.job_id)
        if job:
            job_context = f"Applying for: {job.title}. Required skills: {', '.join(job.required_skills or [])}"

    prompt = f"""Analyze this candidate's work history for retention risk and team fit. Use ONLY concrete data from their CV.

Candidate: {d.get('name')}
Total experience: {exp_years} years across {job_count} positions
Average tenure: {avg_tenure} years/job
Skills: {', '.join((d.get('skills') or [])[:10])}
{job_context}

Work history (most recent first):
{json.dumps(experiences[:5], ensure_ascii=False)}

Job durations: {durations}

Analyze:
1. RETENTION RISK: Based on actual tenure pattern. <1.5yr avg = high risk, 1.5-3yr = medium, >3yr = low
2. CAREER PROGRESSION: Is there clear growth (junior→senior→lead)? Or lateral moves?
3. COMPANY PATTERN: Startup→startup? Corporate→corporate? Jumping between?
4. RED FLAGS: Gaps? Unexplained short stints? Demotion?
5. TEAM FIT: Based on roles held, likely leadership/IC preference?

Reply ONLY valid JSON:
{{"retention_risk": "<low|medium|high>", "avg_tenure_years": {avg_tenure}, "career_trajectory": "<growing|lateral|declining|mixed>", "risk_factors": {{"vi": ["lý do tiếng Việt"], "en": ["reason in English"]}}, "strengths": {{"vi": ["điểm mạnh tiếng Việt"], "en": ["strength in English"]}}, "work_style": "<leader|individual_contributor|both>", "recommendation": {{"vi": "khuyến nghị tiếng Việt", "en": "recommendation in English"}}}}"""

    try:
        # Check cached result
        cached = d.get("_ai_culture_fit")
        if cached and not force:
            return {"candidate_id": candidate_id, "candidate_name": d.get("name", "Unknown"), "job_count": job_count, "exp_years": exp_years, "avg_tenure_years": avg_tenure, **cached}

        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=400, feature="culture_fit", candidate_id=candidate_id)
        data = _parse_json_response(result)
        # Cache result
        await db.execute(text("UPDATE candidates SET structured_data = jsonb_set(structured_data, '{_ai_culture_fit}', CAST(:val AS jsonb)) WHERE id = :cid"),
            {"val": json.dumps(data), "cid": candidate_id})
        await db.commit()
        return {
            "candidate_id": candidate_id,
            "candidate_name": d.get("name", "Unknown"),
            "job_count": job_count,
            "exp_years": exp_years,
            "avg_tenure_years": avg_tenure,
            **data,
        }
    except Exception as e:
        logger.warning(f"Culture fit assessment failed: {e}")
        return {"candidate_id": candidate_id, "retention_risk": "unknown", "recommendation": "Assessment unavailable"}


class TranslateRequest(BaseModel):
    texts: dict[str, str]  # {"key": "text to translate", ...}
    target_locale: str  # "en" | "vi" | "ja"


@router.post("/translate")
async def translate_texts(
    body: TranslateRequest,
    _user: User = Depends(get_current_user),
):
    """Translate AI-generated texts to target language. Uses Claude Haiku."""
    locale_names = {"en": "English", "vi": "Vietnamese", "ja": "Japanese"}
    lang = locale_names.get(body.target_locale, body.target_locale)

    texts_json = json.dumps(body.texts, ensure_ascii=False)
    prompt = f"""Translate the following JSON values to {lang}. Keep keys unchanged. Keep technical terms natural. Return ONLY valid JSON with same keys.

{texts_json}"""

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=2000, temperature=0.1, feature="translate")
        text_resp = result.strip()
        if text_resp.startswith("```"):
            text_resp = text_resp.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text_resp)
    except Exception as e:
        logger.warning(f"Translation failed: {e}")
        return body.texts  # fallback: return original
