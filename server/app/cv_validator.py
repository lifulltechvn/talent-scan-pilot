"""Post-parse validation and normalization for CV structured data."""
from app.skill_normalizer import normalize_skills


def validate_and_normalize(data: dict) -> tuple[dict, float]:
    """Validate parsed CV data, normalize skills, compute confidence score.
    Returns (normalized_data, confidence 0.0-1.0)."""
    if not data:
        return {}, 0.0

    score_factors = 0
    total_factors = 5

    # 1. Name — required
    name = data.get("name", "")
    if isinstance(name, list):
        name = name[0] if name else ""
    name = str(name).strip()
    if name and len(name) > 1:
        score_factors += 1
    data["name"] = name or "Unknown"

    # 2. Skills — must be list of strings
    skills = data.get("skills", [])
    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]
    skills = [str(s) for s in skills if s]
    skills = normalize_skills(skills)
    if len(skills) >= 2:
        score_factors += 1
    data["skills"] = skills

    # 3. Experience years — must be number
    exp_years = data.get("experience_years", 0)
    if isinstance(exp_years, str):
        import re
        nums = re.findall(r"\d+", str(exp_years))
        exp_years = int(nums[0]) if nums else 0
    try:
        exp_years = max(0, min(50, int(float(exp_years))))
    except (ValueError, TypeError):
        exp_years = 0
    if exp_years > 0:
        score_factors += 1
    data["experience_years"] = exp_years
    data["totalYearsExperience"] = exp_years

    # 4. Experience list — should have entries
    experience = data.get("experience", [])
    if not isinstance(experience, list):
        experience = []
    if len(experience) > 0:
        score_factors += 1
    data["experience"] = experience

    # 5. Education — should have entries
    education = data.get("education", [])
    if not isinstance(education, list):
        education = []
    data["education"] = education

    # Derive education_level
    if education:
        levels = {"phd": "phd", "doctor": "phd", "master": "master", "thạc sĩ": "master",
                  "bachelor": "bachelor", "cử nhân": "bachelor", "đại học": "bachelor"}
        edu_level = "bachelor"
        for edu in education:
            degree = str(edu.get("degree", "") or edu.get("major", "")).lower()
            for k, v in levels.items():
                if k in degree:
                    edu_level = v
                    break
        data["education_level"] = edu_level
        score_factors += 1
    elif not data.get("education_level"):
        data["education_level"] = "bachelor"

    # Normalize languages
    languages = data.get("languages", [])
    if isinstance(languages, str):
        languages = [{"language": languages, "level": "Unknown"}]
    data["languages"] = languages if isinstance(languages, list) else []

    # Ensure insight exists
    if not data.get("insight"):
        data["insight"] = {"strengths": "", "weaknesses": "", "recommendation": ""}

    confidence = score_factors / total_factors
    data["_parse_confidence"] = round(confidence, 2)

    return data, confidence
