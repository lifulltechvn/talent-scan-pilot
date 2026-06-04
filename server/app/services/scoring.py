"""
Scoring engine: Rule-based 70% + Claude Haiku LLM evaluation 30%.
"""
import logging

from app.bedrock import invoke_claude
from app.config import settings

logger = logging.getLogger(__name__)


def score_skills(job_skills: list[str], candidate_skills: list[str]) -> tuple[float, dict]:
    if not job_skills:
        return 50.0, {"matched": [], "missing": [], "note": "No skills required"}
    job_set = {s.lower().strip() for s in job_skills}
    cand_set = {s.lower().strip() for s in candidate_skills}
    matched = job_set & cand_set
    missing = job_set - cand_set
    score = (len(matched) / len(job_set)) * 100
    return round(score, 1), {"matched": list(matched), "missing": list(missing)}


def score_experience(required_years: int | None, candidate_years: int | None) -> tuple[float, str]:
    if required_years is None:
        return 50.0, "No requirement specified"
    if candidate_years is None:
        return 30.0, "Candidate experience unknown"
    if candidate_years >= required_years:
        return 100.0, f"{candidate_years}y >= {required_years}y required"
    ratio = candidate_years / required_years
    return round(ratio * 100, 1), f"{candidate_years}y / {required_years}y required"


def score_education(required_level: str | None, candidate_level: str | None) -> tuple[float, str]:
    levels = {"high_school": 1, "associate": 2, "bachelor": 3, "master": 4, "phd": 5}
    if not required_level:
        return 50.0, "No requirement"
    req = levels.get(required_level.lower(), 0)
    cand = levels.get((candidate_level or "").lower(), 0)
    if cand == 0:
        return 30.0, "Education unknown"
    if cand >= req:
        return 100.0, f"{candidate_level} meets {required_level}"
    return round((cand / req) * 100, 1), f"{candidate_level} < {required_level}"


def classify_candidate(final_score: float) -> str:
    if final_score >= 80:
        return "gold"
    elif final_score >= 50:
        return "silver"
    return "talent_pool"


def llm_evaluate(candidate_data: dict, job_title: str = "", job_skills: list[str] | None = None) -> tuple[float, str]:
    """Use Claude Haiku to evaluate candidate (0-100 score + summary)."""
    skills = candidate_data.get("skills", [])
    experience = candidate_data.get("experience", [])
    exp_years = candidate_data.get("experience_years", 0)
    insight = candidate_data.get("insight", {})

    prompt = f"""Evaluate this candidate for the position "{job_title or 'Software Engineer'}".

Required skills: {', '.join(job_skills or [])}

Candidate:
- Skills: {', '.join(skills)}
- Experience: {exp_years} years
- Experience details: {experience[:3]}
- Insight: {insight}

Score 0-100 based on: career progression, skill depth, red flags, culture fit.
Reply in exactly this format:
SCORE: <number>
SUMMARY: <one sentence>"""

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=200, feature="scoring")
        lines = result.strip().split("\n")
        score = 60.0
        summary = result.strip()
        for line in lines:
            if line.startswith("SCORE:"):
                score = float(line.replace("SCORE:", "").strip())
                score = max(0, min(100, score))
            elif line.startswith("SUMMARY:"):
                summary = line.replace("SUMMARY:", "").strip()
        return score, summary
    except Exception as e:
        logger.warning(f"LLM evaluation failed: {e}")
        return 60.0, f"LLM evaluation unavailable: {e}"


def compute_rule_score(
    job_skills: list[str],
    candidate_data: dict,
    required_years: int | None = None,
    required_education: str | None = None,
    job_title: str = "",
    use_llm: bool = True,
) -> dict:
    """
    Compute hybrid score: Rule-based 70% + LLM 30%.
    """
    w = {"skills": 0.30, "cosine": 0.25, "experience": 0.20, "education": 0.15, "language": 0.10}

    cand_skills = candidate_data.get("skills", [])
    cand_years = candidate_data.get("experience_years")
    cand_edu = candidate_data.get("education_level")

    skill_score, skill_detail = score_skills(job_skills, cand_skills)
    exp_score, exp_detail = score_experience(required_years, cand_years)
    edu_score, edu_detail = score_education(required_education, cand_edu)

    # Language score (simplified)
    lang_score = 50.0
    languages = candidate_data.get("languages", [])
    if languages:
        lang_score = 80.0

    rule_score = (
        skill_score * w["skills"]
        + exp_score * w["experience"]
        + edu_score * w["education"]
        + lang_score * w["language"]
    ) / (1 - w["cosine"])  # normalize without cosine (added separately in scoring router)

    rule_score = round(min(100, rule_score), 2)

    # LLM evaluation
    llm_score = 60.0
    llm_summary = ""
    if use_llm:
        llm_score, llm_summary = llm_evaluate(candidate_data, job_title, job_skills)

    # Final: 70% rule + 30% LLM
    final_score = round(rule_score * 0.7 + llm_score * 0.3, 2)
    classification = classify_candidate(final_score)

    return {
        "rule_score": rule_score,
        "llm_score": llm_score,
        "llm_summary": llm_summary,
        "final_score": final_score,
        "classification": classification,
        "details": {
            "skills": {"score": skill_score, **skill_detail},
            "experience": {"score": exp_score, "note": exp_detail},
            "education": {"score": edu_score, "note": edu_detail},
            "language": {"score": lang_score},
            "weights": w,
        },
    }
