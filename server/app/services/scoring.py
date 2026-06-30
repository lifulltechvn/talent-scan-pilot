"""
Scoring engine: Rule-based 70% + Claude Haiku LLM evaluation 30%.
"""
import json
import logging

from app.bedrock import invoke_claude
from app.config import settings

logger = logging.getLogger(__name__)


def _expand_skill(skill: str) -> list[str]:
    """Split compound skill into sub-parts for better matching."""
    s = skill.lower().strip()
    parts = [s]
    # Known aliases (framework ↔ language, tool ↔ category)
    ALIASES = {
        "ci/cd": ["github actions", "gitlab ci", "jenkins", "circleci", "travis"],
        "github actions": ["ci/cd", "cicd"],
        "jenkins": ["ci/cd", "cicd"],
        # Framework → Language
        "laravel": ["php"],
        "symfony": ["php"],
        "php": ["laravel", "symfony"],
        "react": ["javascript", "typescript", "frontend"],
        "vue": ["javascript", "typescript", "frontend"],
        "angular": ["javascript", "typescript", "frontend"],
        "next.js": ["react", "javascript", "typescript"],
        "nuxt": ["vue", "javascript"],
        "express": ["node.js", "javascript"],
        "fastapi": ["python"],
        "django": ["python"],
        "flask": ["python"],
        "spring boot": ["java"],
        "spring": ["java"],
        "ruby on rails": ["ruby"],
        "rails": ["ruby"],
        "node.js": ["javascript", "typescript"],
        "nodejs": ["javascript", "typescript"],
        # Cloud/Infra
        "kubernetes": ["k8s", "docker", "container"],
        "k8s": ["kubernetes", "docker"],
        "terraform": ["iac", "infrastructure"],
        "aws": ["cloud"],
        "gcp": ["cloud"],
        "azure": ["cloud"],
    }
    if s in ALIASES:
        parts.extend(ALIASES[s])
    # Split by & / , or
    for sep in [' & ', ' / ', ', ', ' or ']:
        if sep in s:
            parts.extend(p.strip() for p in s.split(sep) if p.strip())
    # Extract parenthetical
    if '(' in s and ')' in s:
        before = s[:s.index('(')].strip()
        inside = s[s.index('(')+1:s.index(')')].strip()
        if before:
            parts.append(before)
        if inside:
            parts.append(inside)
    return parts


def score_skills(job_skills: list[str], candidate_skills: list[str], job_skills_expanded: list[str] | None = None) -> tuple[float, dict]:
    from app.skill_normalizer import normalize_skills
    if not job_skills:
        return 50.0, {"matched": [], "missing": [], "note": "No skills required"}
    job_normalized = [s.lower().strip() for s in normalize_skills(job_skills)]
    cand_normalized = [s.lower().strip() for s in normalize_skills(candidate_skills)]
    cand_expanded = set()
    for cs in cand_normalized:
        cand_expanded.update(_expand_skill(cs))

    expanded_set = set(s.lower().strip() for s in (job_skills_expanded or []))
    def _is_match(js):
        js_parts = _expand_skill(js)
        for jp in js_parts:
            for cs in cand_expanded:
                if jp == cs or jp in cs or cs in jp:
                    return True
        j_words = set(js.replace('/', ' ').replace('&', ' ').replace('(', ' ').replace(')', ' ').split())
        j_words.discard('')
        for cs in cand_expanded:
            c_words = set(cs.replace('/', ' ').replace('&', ' ').replace('(', ' ').replace(')', ' ').split())
            c_words.discard('')
            if j_words and c_words and len(j_words & c_words) / len(j_words) >= 0.5:
                return True
        # Check against expanded list (AI-generated equivalents)
        if expanded_set:
            for cs in cand_expanded:
                if cs in expanded_set:
                    return True
        return False

    matched = []
    for js in job_normalized:
        # Handle OR-groups: "go/java/python/ruby" → match ANY
        alternatives = [a.strip() for a in js.split("/")]
        found = any(_is_match(alt) for alt in alternatives)
        if found:
            matched.append(js)

    missing = [js for js in job_normalized if js not in matched]
    score = (len(matched) / len(job_normalized)) * 100
    return round(score, 1), {"matched": matched, "missing": missing}


def score_experience(required_years: int | None, candidate_years: int | None, candidate_category: str | None = None, job_category: str | None = None) -> tuple[float, str]:
    """Score experience considering relevance between candidate category and job category."""
    if required_years is None:
        return 80.0, "No requirement specified"
    if candidate_years is None:
        return 30.0, "Candidate experience unknown"

    # Calculate relevance factor based on category match
    relevance = _category_relevance(candidate_category, job_category)
    effective_years = candidate_years * relevance

    if effective_years >= required_years:
        if relevance < 1.0:
            return round(min(100, (effective_years / required_years) * 100), 1), f"{candidate_years}y ({candidate_category}) × {relevance} relevance = {effective_years:.1f}y effective >= {required_years}y required"
        return 100.0, f"{candidate_years}y >= {required_years}y required"

    ratio = effective_years / required_years
    if relevance < 1.0:
        return round(ratio * 100, 1), f"{candidate_years}y ({candidate_category}) × {relevance} relevance = {effective_years:.1f}y effective / {required_years}y required"
    return round(ratio * 100, 1), f"{candidate_years}y / {required_years}y required"


# Category relevance matrix: how transferable is experience between categories
# 1.0 = same field, 0.7 = closely related, 0.4 = partially related, 0.2 = unrelated
_CATEGORY_RELEVANCE = {
    #                         app_eng  bridge   qa      admin   hr
    "application_engineer": {"application_engineer": 1.0, "bridge_se": 0.7, "qa_engineer": 0.6, "admin": 0.2, "hr": 0.2},
    "bridge_se":            {"application_engineer": 0.7, "bridge_se": 1.0, "qa_engineer": 0.5, "admin": 0.3, "hr": 0.3},
    "qa_engineer":          {"application_engineer": 0.6, "bridge_se": 0.5, "qa_engineer": 1.0, "admin": 0.2, "hr": 0.2},
    "admin":                {"application_engineer": 0.2, "bridge_se": 0.3, "qa_engineer": 0.2, "admin": 1.0, "hr": 0.6},
    "hr":                   {"application_engineer": 0.2, "bridge_se": 0.3, "qa_engineer": 0.2, "admin": 0.6, "hr": 1.0},
}


def _category_relevance(candidate_category: str | None, job_category: str | None) -> float:
    """Get relevance factor between candidate's background and job category."""
    if not candidate_category or not job_category:
        return 1.0  # No category info → don't penalize
    if candidate_category == job_category:
        return 1.0
    return _CATEGORY_RELEVANCE.get(candidate_category, {}).get(job_category, 0.3)


def score_education(required_level: str | None, candidate_level: str | None) -> tuple[float, str]:
    levels = {"high_school": 1, "associate": 2, "bachelor": 3, "master": 4, "phd": 5}
    if not required_level:
        return 80.0, "No requirement"
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
    return "bronze"


def llm_evaluate(candidate_data: dict, job_title: str = "", job_skills: list[str] | None = None, candidate_id: str | None = None, job_description: str = "") -> tuple[float, str]:
    """Use Claude Haiku to evaluate candidate (0-100 score + summary)."""
    from app.prompts import SCORING_PROMPT
    from app.injection_guard import sanitize_for_llm

    skills = candidate_data.get("skills", [])
    experience = candidate_data.get("experience", [])
    exp_years = candidate_data.get("experience_years", 0)
    insight = candidate_data.get("insight", {})

    # Sanitize candidate-controlled strings before embedding in prompt
    safe_skills = ", ".join(str(s)[:50] for s in skills[:15])
    safe_experience = str(experience[:3])[:500]

    prompt = SCORING_PROMPT.format(
        job_title=job_title or "Software Engineer",
        job_skills=", ".join(job_skills or []),
        job_description=job_description[:300] if job_description else "",
        skills=safe_skills,
        exp_years=exp_years,
        experience=safe_experience,
        insight=str(insight)[:200],
    )

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=600, feature="scoring", candidate_id=candidate_id)
        lines = result.strip().split("\n")
        score = 60.0
        summary = result.strip()
        i18n_data = {"en": {}, "vi": {}, "ja": {}}
        for line in lines:
            if line.startswith("SCORE:"):
                score = float(line.replace("SCORE:", "").strip())
                score = max(0, min(100, score))
            elif line.startswith("SUMMARY_EN:"):
                i18n_data["en"]["summary"] = line.replace("SUMMARY_EN:", "").strip()
            elif line.startswith("SUMMARY_VI:"):
                i18n_data["vi"]["summary"] = line.replace("SUMMARY_VI:", "").strip()
            elif line.startswith("SUMMARY_JA:"):
                i18n_data["ja"]["summary"] = line.replace("SUMMARY_JA:", "").strip()
            elif line.startswith("STRENGTHS_EN:"):
                i18n_data["en"]["strengths"] = [s.strip() for s in line.replace("STRENGTHS_EN:", "").strip().split(",") if s.strip()]
            elif line.startswith("STRENGTHS_VI:"):
                i18n_data["vi"]["strengths"] = [s.strip() for s in line.replace("STRENGTHS_VI:", "").strip().split(",") if s.strip()]
            elif line.startswith("CONCERNS_EN:"):
                i18n_data["en"]["concerns"] = [s.strip() for s in line.replace("CONCERNS_EN:", "").strip().split(",") if s.strip()]
            elif line.startswith("CONCERNS_VI:"):
                i18n_data["vi"]["concerns"] = [s.strip() for s in line.replace("CONCERNS_VI:", "").strip().split(",") if s.strip()]
            elif line.startswith("SUGGESTION_EN:"):
                i18n_data["en"]["suggestion"] = line.replace("SUGGESTION_EN:", "").strip()
            elif line.startswith("SUGGESTION_VI:"):
                i18n_data["vi"]["suggestion"] = line.replace("SUGGESTION_VI:", "").strip()
            # Legacy fallback
            elif line.startswith("SUMMARY:"):
                summary = line.replace("SUMMARY:", "").strip()
            elif line.startswith("STRENGTHS:"):
                i18n_data["vi"]["strengths"] = [s.strip() for s in line.replace("STRENGTHS:", "").strip().split(",") if s.strip()]
            elif line.startswith("CONCERNS:"):
                i18n_data["vi"]["concerns"] = [s.strip() for s in line.replace("CONCERNS:", "").strip().split(",") if s.strip()]
            elif line.startswith("SUGGESTION:"):
                i18n_data["vi"]["suggestion"] = line.replace("SUGGESTION:", "").strip()

        full_summary = json.dumps(i18n_data, ensure_ascii=False) if i18n_data["en"] else summary
        return score, full_summary
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
    candidate_id: str | None = None,
    job_description: str = "",
    job_skills_expanded: list[str] | None = None,
    job_category: str | None = None,
) -> dict:
    """
    Compute hybrid score: Rule-based 70% + LLM 30%.
    """
    w = {"skills": 0.30, "cosine": 0.25, "experience": 0.20, "education": 0.15, "language": 0.10}

    cand_skills = candidate_data.get("skills", [])
    cand_years = candidate_data.get("experience_years")
    cand_edu = candidate_data.get("education_level")
    cand_category = (candidate_data.get("skill_level") or {}).get("category")

    skill_score, skill_detail = score_skills(job_skills, cand_skills, job_skills_expanded=job_skills_expanded)
    exp_score, exp_detail = score_experience(required_years, cand_years, candidate_category=cand_category, job_category=job_category)
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
        llm_score, llm_summary = llm_evaluate(candidate_data, job_title, job_skills, candidate_id=candidate_id, job_description=job_description)

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
