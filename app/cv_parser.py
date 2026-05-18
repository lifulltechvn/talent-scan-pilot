"""Mock CV parser: extract structured data from text using keyword matching.
Will be replaced by GPT-4o in W6."""

import re

SKILL_KEYWORDS = [
    "Python", "Java", "JavaScript", "TypeScript", "React", "Vue", "Angular",
    "FastAPI", "Django", "Flask", "Spring Boot", "Node.js", "Next.js",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes",
    "AWS", "GCP", "Azure", "Terraform", "CI/CD", "Git",
    "TailwindCSS", "HTML", "CSS", "REST API", "GraphQL",
    "Machine Learning", "AI", "NLP", "Data Science",
    "Linux", "Nginx", "C++", "C#", ".NET", "Go", "Rust", "PHP", "Laravel",
]

EDUCATION_KEYWORDS = {
    "phd": ["phd", "tiến sĩ", "doctor"],
    "master": ["master", "thạc sĩ", "mba"],
    "bachelor": ["bachelor", "cử nhân", "đại học", "university", "college"],
    "associate": ["cao đẳng", "associate"],
    "high_school": ["trung học", "high school"],
}


def parse_cv_text(text: str, file_name: str) -> dict:
    """Parse extracted CV text into structured data using keyword matching."""
    text_lower = text.lower()

    # Extract skills
    skills = [s for s in SKILL_KEYWORDS if s.lower() in text_lower]

    # Extract experience years
    exp_match = re.search(r"(\d+)\+?\s*(?:năm|year|yr)", text_lower)
    experience_years = int(exp_match.group(1)) if exp_match else None

    # Extract education level
    education_level = None
    for level, keywords in EDUCATION_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            education_level = level
            break

    # Extract name from filename or first line
    name = file_name.replace(".pdf", "").replace(".docx", "").replace("_", " ").replace("-", " ").title()
    first_line = text.strip().split("\n")[0].strip() if text.strip() else ""
    if first_line and len(first_line) < 50 and not any(c.isdigit() for c in first_line):
        name = first_line

    return {
        "name": name,
        "skills": skills if skills else ["General"],
        "experience_years": experience_years or 2,
        "education_level": education_level or "bachelor",
        "summary": text[:500].strip(),
    }
