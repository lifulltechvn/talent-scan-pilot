"""
Rule-based scoring engine.
Evaluates candidates against job requirements using structured data.
"""


def score_skills(job_skills: list[str], candidate_skills: list[str]) -> tuple[float, dict]:
    """Score skill match (0-100). Returns (score, details)."""
    if not job_skills:
        return 50.0, {"matched": [], "missing": [], "note": "No skills required"}
    job_set = {s.lower().strip() for s in job_skills}
    cand_set = {s.lower().strip() for s in candidate_skills}
    matched = job_set & cand_set
    missing = job_set - cand_set
    score = (len(matched) / len(job_set)) * 100
    return round(score, 1), {"matched": list(matched), "missing": list(missing)}


def score_experience(required_years: int | None, candidate_years: int | None) -> tuple[float, str]:
    """Score experience match (0-100)."""
    if required_years is None:
        return 50.0, "No requirement specified"
    if candidate_years is None:
        return 30.0, "Candidate experience unknown"
    if candidate_years >= required_years:
        return 100.0, f"{candidate_years}y >= {required_years}y required"
    ratio = candidate_years / required_years
    return round(ratio * 100, 1), f"{candidate_years}y / {required_years}y required"


def score_education(required_level: str | None, candidate_level: str | None) -> tuple[float, str]:
    """Score education match (0-100)."""
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
    """Classify based on final score."""
    if final_score >= 80:
        return "gold"
    elif final_score >= 60:
        return "silver"
    return "talent_pool"


def compute_rule_score(
    job_skills: list[str],
    candidate_data: dict,
    required_years: int | None = None,
    required_education: str | None = None,
    weights: dict | None = None,
) -> dict:
    """
    Compute rule-based score from structured candidate data.
    candidate_data expected keys: skills, experience_years, education_level
    Returns: {rule_score, classification, details}
    """
    w = weights or {"skills": 0.5, "experience": 0.3, "education": 0.2}

    cand_skills = candidate_data.get("skills", [])
    cand_years = candidate_data.get("experience_years")
    cand_edu = candidate_data.get("education_level")

    skill_score, skill_detail = score_skills(job_skills, cand_skills)
    exp_score, exp_detail = score_experience(required_years, cand_years)
    edu_score, edu_detail = score_education(required_education, cand_edu)

    final = (
        skill_score * w["skills"]
        + exp_score * w["experience"]
        + edu_score * w["education"]
    )

    return {
        "rule_score": round(final, 2),
        "classification": classify_candidate(final),
        "details": {
            "skills": {"score": skill_score, **skill_detail},
            "experience": {"score": exp_score, "note": exp_detail},
            "education": {"score": edu_score, "note": edu_detail},
            "weights": w,
        },
    }
