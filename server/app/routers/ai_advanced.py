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


# ============ #1: AI Detect CV giả ============

class AuthenticityResult(BaseModel):
    score: int  # 0-100 (100 = authentic)
    verdict: str  # authentic / suspicious / likely_ai
    reasons: list[str]
    details: dict


@router.post("/cv-authenticity/{candidate_id}")
async def check_cv_authenticity(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """AI-powered CV authenticity check. Detects AI-generated or fake CVs."""
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    d = candidate.structured_data or {}
    cv_text = json.dumps({
        "name": d.get("name"),
        "skills": d.get("skills", []),
        "experience": d.get("experience", []),
        "education": d.get("education", []),
        "experience_years": d.get("experience_years"),
    }, ensure_ascii=False)

    prompt = f"""Analyze this CV data for authenticity. Detect if it was likely AI-generated or contains fake/exaggerated information.

<CV_DATA>
{cv_text[:3000]}
</CV_DATA>

Check for:
1. Language too polished/generic (AI-written patterns)
2. Unrealistic achievements (e.g. "increased revenue 500% in 1 month")
3. Timeline inconsistencies (overlapping jobs, impossible progression)
4. Vague descriptions without concrete details (buzzwords without substance)
5. Missing specifics (no tool versions, no team sizes, no metrics)
6. Copy-paste patterns (same sentence structure repeated)

Reply in this exact JSON format:
{{"score": <0-100 where 100=definitely authentic>, "verdict": "<authentic|suspicious|likely_ai>", "reasons": ["reason1", "reason2", ...], "red_flags": ["flag1", ...], "green_flags": ["flag1", ...]}}

Rules:
- score 80-100: authentic (real human CV)
- score 50-79: suspicious (some red flags)
- score 0-49: likely AI-generated or fake
- Provide 2-5 specific reasons
- Be fair: many real CVs are well-written"""

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=500, feature="cv_authenticity", candidate_id=candidate_id)
        data = json.loads(result)
        return {
            "candidate_id": candidate_id,
            "candidate_name": d.get("name", "Unknown"),
            "score": data.get("score", 70),
            "verdict": data.get("verdict", "unknown"),
            "reasons": data.get("reasons", []),
            "red_flags": data.get("red_flags", []),
            "green_flags": data.get("green_flags", []),
        }
    except Exception as e:
        logger.warning(f"CV authenticity check failed: {e}")
        return {"candidate_id": candidate_id, "score": 70, "verdict": "unknown", "reasons": ["Analysis failed"], "red_flags": [], "green_flags": []}


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
        data = json.loads(result)
        return data
    except Exception as e:
        logger.warning(f"Interview coaching failed: {e}")
        return {"overall_quality": "unknown", "assessments": [], "bias_warning": None, "summary": "Analysis unavailable"}


# ============ #4: AI Culture Fit ============

@router.post("/culture-fit/{candidate_id}")
async def assess_culture_fit(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Assess candidate's culture fit based on CV patterns vs company profile."""
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    d = candidate.structured_data or {}

    # Get company context (top performers pattern)
    top_candidates = await db.execute(text("""
        SELECT structured_data FROM candidates
        WHERE status = 'approved' AND structured_data IS NOT NULL
        ORDER BY match_score DESC NULLS LAST LIMIT 5
    """))
    top_profiles = [r["structured_data"] for r in top_candidates.mappings().all()]

    top_summary = ""
    if top_profiles:
        avg_years = sum(p.get("experience_years", 0) for p in top_profiles) / len(top_profiles)
        all_skills = [s for p in top_profiles for s in (p.get("skills") or [])]
        common_skills = sorted(set(s for s in all_skills if all_skills.count(s) >= 2))[:10]
        top_summary = f"Avg experience: {avg_years:.0f} years. Common skills: {', '.join(common_skills)}"

    # Analyze job tenure
    experiences = d.get("experience", [])
    tenure_info = ""
    if experiences:
        durations = [e.get("duration", e.get("years", "")) for e in experiences]
        tenure_info = f"Job history: {len(experiences)} positions. Durations: {durations}"

    prompt = f"""Assess this candidate's culture fit and retention risk for a tech company (LIFULL Tech Vietnam).

Candidate: {d.get('name')}
Experience: {d.get('experience_years', 0)} years
Skills: {', '.join((d.get('skills') or [])[:10])}
{tenure_info}

Company top performers profile:
{top_summary or 'No data available'}

Analyze:
1. Culture fit score (0-100)
2. Retention risk (low/medium/high) based on job-hopping pattern
3. Growth potential
4. Team fit assessment

Reply in JSON:
{{"culture_score": <0-100>, "retention_risk": "<low|medium|high>", "avg_tenure_months": <number or null>, "growth_potential": "<high|medium|low>", "fit_reasons": ["..."], "risk_factors": ["..."], "recommendation": "..."}}"""

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=400, feature="culture_fit", candidate_id=candidate_id)
        data = json.loads(result)
        return {
            "candidate_id": candidate_id,
            "candidate_name": d.get("name", "Unknown"),
            **data,
        }
    except Exception as e:
        logger.warning(f"Culture fit assessment failed: {e}")
        return {"candidate_id": candidate_id, "culture_score": 50, "retention_risk": "unknown", "recommendation": "Assessment unavailable"}
