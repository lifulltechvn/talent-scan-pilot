"""AWS Bedrock service — replaces OpenAI for all AI calls in Desktop App.
When AWS credentials are set, calls real Bedrock API.
When not set, returns mock data for development."""

import base64
import hashlib
import json
import os
import random
import re

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
MODEL_SONNET = os.environ.get("BEDROCK_MODEL_SONNET", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
MODEL_EMBEDDING = os.environ.get("BEDROCK_MODEL_EMBEDDING", "amazon.titan-embed-text-v2:0")

_client = None


def _has_credentials() -> bool:
    return bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)


def _get_client():
    global _client
    if _client is None:
        import boto3
        _client = boto3.client(
            "bedrock-runtime",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )
    return _client


def parse_cv_with_gpt(text: str, file_name: str) -> dict:
    """Parse CV text into structured data using Claude Sonnet (or mock)."""
    if _has_credentials():
        client = _get_client()
        tools = [{
            "name": "save_cv_data",
            "description": "Save parsed CV data",
            "input_schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                    "skills": {"type": "array", "items": {"type": "string"}},
                    "experience": {"type": "array", "items": {"type": "object", "properties": {"company": {"type": "string"}, "role": {"type": "string"}, "duration": {"type": "string"}}}},
                    "education": {"type": "array", "items": {"type": "object", "properties": {"school": {"type": "string"}, "degree": {"type": "string"}, "year": {"type": "string"}}}},
                    "languages": {"type": "array", "items": {"type": "object", "properties": {"language": {"type": "string"}, "level": {"type": "string"}}}},
                    "experience_years": {"type": "number"},
                    "expected_salary": {"type": "string"},
                    "insight": {"type": "object", "properties": {"strengths": {"type": "string"}, "weaknesses": {"type": "string"}, "recommendation": {"type": "string"}}},
                },
                "required": ["name", "skills", "experience", "education", "experience_years", "insight"],
            },
        }]

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "temperature": 0,
            "system": "You are a CV parser. Anonymize PII: replace real name with [NAME], email with [EMAIL], phone with [PHONE]. Parse the CV into structured data. Provide a 3-line insight (strengths, weaknesses, recommendation).",
            "messages": [{"role": "user", "content": f"Parse this CV:\n\n{text[:6000]}"}],
            "tools": tools,
            "tool_choice": {"type": "tool", "name": "save_cv_data"},
        }

        response = client.invoke_model(modelId=MODEL_SONNET, body=json.dumps(body))
        result = json.loads(response["body"].read())

        for block in result["content"]:
            if block["type"] == "tool_use":
                return block["input"]
        return {}

    return _mock_parse(text, file_name)


def ocr_scanned_pdf(image_bytes: bytes) -> str:
    """OCR a scanned PDF using Claude Sonnet Vision (or mock)."""
    if _has_credentials():
        client = _get_client()
        b64 = base64.b64encode(image_bytes).decode()

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "temperature": 0,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                    {"type": "text", "text": "Extract all text from this CV image. Preserve structure and formatting. Output raw text only, no commentary."},
                ],
            }],
        }

        response = client.invoke_model(modelId=MODEL_SONNET, body=json.dumps(body))
        result = json.loads(response["body"].read())
        return result["content"][0]["text"]

    return "[Mock OCR] This is simulated text from a scanned document. Skills: Python, React, AWS. Experience: 5 years."


def get_embedding(text: str) -> list[float]:
    """Get 1024-dim embedding from Amazon Titan Embedding V2 (or mock)."""
    if _has_credentials():
        client = _get_client()
        body = {"inputText": text[:8000], "dimensions": 1024, "normalize": True}
        response = client.invoke_model(modelId=MODEL_EMBEDDING, body=json.dumps(body))
        result = json.loads(response["body"].read())
        return result["embedding"]

    # Mock fallback - deterministic 1024-dim vector
    seed = int(hashlib.md5(text.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    vec = [rng.gauss(0, 1) for _ in range(1024)]
    norm = sum(x * x for x in vec) ** 0.5
    return [x / norm for x in vec]


def _mock_parse(text: str, file_name: str) -> dict:
    """Generate realistic mock structured data from CV text."""
    text_lower = text.lower()
    name = file_name.replace(".pdf", "").replace(".docx", "").replace("_", " ").replace("-", " ").title()
    first_line = text.strip().split("\n")[0].strip() if text.strip() else ""
    if first_line and len(first_line) < 50 and not any(c.isdigit() for c in first_line):
        name = first_line

    all_skills = [
        "Python", "Java", "JavaScript", "TypeScript", "React", "Vue", "Angular",
        "FastAPI", "Django", "Flask", "Spring Boot", "Node.js", "Next.js",
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes",
        "AWS", "GCP", "Azure", "Terraform", "CI/CD", "Git",
    ]
    skills = [s for s in all_skills if s.lower() in text_lower]
    if not skills:
        skills = random.sample(all_skills, k=random.randint(3, 6))

    exp_match = re.search(r"(\d+)\+?\s*(?:năm|year|yr)", text_lower)
    exp_years = int(exp_match.group(1)) if exp_match else random.randint(2, 8)

    companies = ["TechCorp", "DataFlow Inc", "CloudBase", "AI Solutions", "WebDev Co"]
    roles = ["Software Engineer", "Senior Developer", "Tech Lead", "Full Stack Developer"]
    experience = [{"company": random.choice(companies), "role": random.choice(roles), "duration": f"{random.randint(1,3)} years"} for _ in range(random.randint(2, 4))]
    education = [{"school": "University of Technology", "degree": "Bachelor of CS", "year": str(random.randint(2012, 2020))}]
    languages = [{"language": "English", "level": "Intermediate"}]
    if "日本語" in text or "japanese" in text_lower:
        languages.append({"language": "Japanese", "level": "N2"})

    return {
        "name": name, "skills": skills, "experience": experience, "education": education,
        "languages": languages, "experience_years": exp_years, "expected_salary": None,
        "insight": {
            "strengths": f"Strong in {', '.join(skills[:3])}. {exp_years} years experience.",
            "weaknesses": "Could benefit from more leadership experience.",
            "recommendation": "Strong candidate" if exp_years >= 3 and len(skills) >= 4 else "Consider for junior/mid role",
        },
    }
