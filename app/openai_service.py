"""OpenAI API wrapper with mock fallback.
When OPENAI_API_KEY is set, calls real OpenAI API.
When not set, returns realistic mock data for development."""

import json
import os
import random

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

_HAS_KEY = bool(OPENAI_API_KEY)


def _get_client():
    if not _HAS_KEY:
        return None
    from openai import OpenAI
    return OpenAI(api_key=OPENAI_API_KEY)


def parse_cv_with_gpt(text: str, file_name: str) -> dict:
    """Parse CV text into structured data using GPT-4o (or mock)."""
    if _HAS_KEY:
        client = _get_client()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a CV parser. Extract structured data from the CV text. Return JSON only."},
                {"role": "user", "content": f"Parse this CV and return JSON with fields: name, skills (array), experience (array of {{company, role, duration}}), education (array of {{school, degree, year}}), languages (array of {{language, level}}), experience_years (number), expected_salary (string or null), insight ({{strengths, weaknesses, recommendation}}).\n\nCV text:\n{text[:4000]}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        return json.loads(response.choices[0].message.content)

    # Mock fallback
    return _mock_parse(text, file_name)


def ocr_scanned_pdf(image_bytes: bytes) -> str:
    """OCR a scanned PDF page using GPT-4o Vision (or mock)."""
    if _HAS_KEY:
        import base64
        client = _get_client()
        b64 = base64.b64encode(image_bytes).decode()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": "Extract all text from this CV image. Return the raw text only."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                ]},
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content

    # Mock fallback
    return "[Mock OCR] This is simulated text from a scanned document. Skills: Python, React, AWS. Experience: 5 years."


def get_embedding(text: str) -> list[float]:
    """Get embedding vector using OpenAI (or mock)."""
    if _HAS_KEY:
        client = _get_client()
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text[:8000],
        )
        return response.data[0].embedding

    # Mock fallback - deterministic random vector
    import hashlib
    seed = int(hashlib.md5(text.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    vec = [rng.gauss(0, 1) for _ in range(1536)]
    norm = sum(x * x for x in vec) ** 0.5
    return [x / norm for x in vec]


def _mock_parse(text: str, file_name: str) -> dict:
    """Generate realistic mock structured data from CV text."""
    text_lower = text.lower()

    # Extract name from filename
    name = file_name.replace(".pdf", "").replace(".docx", "").replace("_", " ").replace("-", " ").title()
    first_line = text.strip().split("\n")[0].strip() if text.strip() else ""
    if first_line and len(first_line) < 50 and not any(c.isdigit() for c in first_line):
        name = first_line

    # Skills detection
    all_skills = [
        "Python", "Java", "JavaScript", "TypeScript", "React", "Vue", "Angular",
        "FastAPI", "Django", "Flask", "Spring Boot", "Node.js", "Next.js",
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes",
        "AWS", "GCP", "Azure", "Terraform", "CI/CD", "Git",
        "Machine Learning", "AI", "NLP", "Data Science", "Go", "Rust", "C++",
    ]
    skills = [s for s in all_skills if s.lower() in text_lower]
    if not skills:
        skills = random.sample(all_skills, k=random.randint(3, 6))

    # Experience years
    import re
    exp_match = re.search(r"(\d+)\+?\s*(?:năm|year|yr)", text_lower)
    exp_years = int(exp_match.group(1)) if exp_match else random.randint(2, 8)

    # Mock experience entries
    companies = ["TechCorp", "DataFlow Inc", "CloudBase", "AI Solutions", "WebDev Co"]
    roles = ["Software Engineer", "Senior Developer", "Tech Lead", "Full Stack Developer", "Backend Engineer"]
    experience = [
        {"company": random.choice(companies), "role": random.choice(roles), "duration": f"{random.randint(1,3)} years"}
        for _ in range(random.randint(2, 4))
    ]

    # Mock education
    schools = ["University of Technology", "National University", "Tech Institute", "Engineering College"]
    education = [{"school": random.choice(schools), "degree": "Bachelor of Computer Science", "year": str(random.randint(2012, 2020))}]

    # Languages
    languages = [{"language": "English", "level": random.choice(["Intermediate", "Advanced", "Fluent"])}]
    if "日本語" in text or "japanese" in text_lower:
        languages.append({"language": "Japanese", "level": random.choice(["N2", "N3", "Business"])})

    return {
        "name": name,
        "skills": skills,
        "experience": experience,
        "education": education,
        "languages": languages,
        "experience_years": exp_years,
        "expected_salary": None,
        "insight": {
            "strengths": f"Strong technical skills in {', '.join(skills[:3])}. {exp_years} years of relevant experience.",
            "weaknesses": "Could benefit from more leadership experience." if exp_years < 5 else "Senior profile, may have high salary expectations.",
            "recommendation": "Strong candidate" if exp_years >= 3 and len(skills) >= 4 else "Consider for junior/mid role",
        },
    }
