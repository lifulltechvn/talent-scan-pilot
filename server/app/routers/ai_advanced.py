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
    raise ValueError(f"Cannot parse JSON from: {cleaned[:200]}")


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
    descriptions = [e.get("description", "") for e in experience if e.get("description")]
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

Reply ONLY valid JSON:
{{"score": <0-100, 100=authentic>, "verdict": "<authentic|suspicious|likely_ai>", "reasons": ["specific evidence 1", "specific evidence 2", ...], "red_flags": ["concrete flag with quote from CV"], "green_flags": ["concrete positive sign with quote"]}}"""

    try:
        # Check cached result
        cached = d.get("_ai_authenticity")
        if cached and not force:
            return {"candidate_id": candidate_id, "candidate_name": d.get("name", "Unknown"), **cached}

        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=800, feature="cv_authenticity", candidate_id=candidate_id)
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
        await db.execute(text("UPDATE candidates SET structured_data = jsonb_set(structured_data, '{_ai_authenticity}', :val::jsonb) WHERE id = :cid"),
            {"val": json.dumps(response), "cid": candidate_id})
        await db.commit()
        return {"candidate_id": candidate_id, "candidate_name": d.get("name", "Unknown"), **response}
    except Exception as e:
        logger.warning(f"CV authenticity check failed: {e}")
        return {"candidate_id": candidate_id, "score": 70, "verdict": "unknown", "reasons": [f"Analysis error: {str(e)[:100]}"], "red_flags": [], "green_flags": []}


# ============ #2: AI Interview Coaching ============

@router.post("/interview-coaching/{interview_id}")
async def get_interview_coaching(
    interview_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Analyze interviewer feedback quality and provide coaching tips."""
    # Get all feedback for this interview
    rows = await db.execute(text("""
        SELECT ii.score, ii.notes, u.full_name
        FROM interview_interviewers ii
        JOIN users u ON u.id = ii.user_id
        WHERE ii.interview_id = :iid AND ii.score IS NOT NULL
    """), {"iid": interview_id})
    feedback_list = rows.mappings().all()

    if not feedback_list:
        raise HTTPException(400, "No feedback submitted yet")

    # Get interview context
    iv = await db.execute(text("""
        SELECT i.title, i.round, c.structured_data->>'name' as candidate_name, j.title as job_title
        FROM interviews i
        LEFT JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN jobs j ON j.id = i.job_id
        WHERE i.id = :iid
    """), {"iid": interview_id})
    context = iv.mappings().first()

    feedback_text = "\n".join([
        f"- {fb['full_name']}: Score {fb['score']}/10, Notes: \"{fb['notes'] or 'No notes'}\""
        for fb in feedback_list
    ])

    prompt = f"""Analyze these interview feedback submissions and provide coaching for the interviewers.

Interview: {context['job_title'] or 'Unknown'} - Round {context['round']}
Candidate: {context['candidate_name']}

Feedback from interviewers:
{feedback_text}

Analyze and provide:
1. Quality assessment of each feedback (is it detailed enough? actionable?)
2. Bias detection (all same score? extreme scores without justification?)
3. Consistency check (do scores align with notes?)
4. Coaching tips for improvement

Reply in JSON:
{{"overall_quality": "<good|needs_improvement|poor>", "assessments": [{{"name": "...", "quality": "<good|fair|poor>", "issue": "...", "tip": "..."}}], "bias_warning": null or "...", "summary": "..."}}"""

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=500, feature="interview_coaching")
        data = _parse_json_response(result)
        return data
    except Exception as e:
        logger.warning(f"Interview coaching failed: {e}")
        return {"overall_quality": "unknown", "assessments": [], "bias_warning": None, "summary": "Analysis unavailable"}


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
{{"retention_risk": "<low|medium|high>", "avg_tenure_years": {avg_tenure}, "career_trajectory": "<growing|lateral|declining|mixed>", "risk_factors": ["specific factor with evidence"], "strengths": ["specific strength with evidence"], "work_style": "<leader|individual_contributor|both>", "recommendation": "1 sentence actionable advice for HR"}}"""

    try:
        # Check cached result
        cached = d.get("_ai_culture_fit")
        if cached and not force:
            return {"candidate_id": candidate_id, "candidate_name": d.get("name", "Unknown"), "job_count": job_count, "exp_years": exp_years, "avg_tenure_years": avg_tenure, **cached}

        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=400, feature="culture_fit", candidate_id=candidate_id)
        data = _parse_json_response(result)
        # Cache result
        await db.execute(text("UPDATE candidates SET structured_data = jsonb_set(structured_data, '{_ai_culture_fit}', :val::jsonb) WHERE id = :cid"),
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
