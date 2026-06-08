"""CV Upload service: extract → OCR → PII → parse → embed → save."""
import base64
import json
import logging
import uuid
from dataclasses import asdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.bedrock import get_bedrock_client, get_embedding, _log_usage
from app.config import settings
from app.extractor import extract
from app.models import Candidate
from app.pii_filter import filter_pii

logger = logging.getLogger(__name__)


def _ocr_scanned_pdf(file_bytes: bytes) -> str:
    """OCR a scanned PDF using Claude Sonnet Vision."""
    client = get_bedrock_client()
    b64 = base64.b64encode(file_bytes).decode()
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                {"type": "text", "text": "Extract all text from this CV image. Preserve structure. Output raw text only."},
            ],
        }],
    }
    response = client.invoke_model(modelId=settings.BEDROCK_MODEL_SONNET, body=json.dumps(body))
    result = json.loads(response["body"].read())
    usage = result.get("usage", {})
    _log_usage(settings.BEDROCK_MODEL_SONNET, "ocr", usage.get("input_tokens", 0), usage.get("output_tokens", 0))
    return result["content"][0]["text"]


def _parse_cv_text(text: str) -> dict:
    """Parse CV text into structured data using Claude Sonnet with tool_use."""
    client = get_bedrock_client()
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
        "system": "You are a CV parser. Extract the candidate's real name as-is. Parse the CV into structured data.",
        "messages": [{"role": "user", "content": f"Parse this CV:\n\n{text[:6000]}"}],
        "tools": tools,
        "tool_choice": {"type": "tool", "name": "save_cv_data"},
    }
    response = client.invoke_model(modelId=settings.BEDROCK_MODEL_SONNET, body=json.dumps(body))
    result = json.loads(response["body"].read())
    usage = result.get("usage", {})
    _log_usage(settings.BEDROCK_MODEL_SONNET, "cv_parsing", usage.get("input_tokens", 0), usage.get("output_tokens", 0))
    for block in result["content"]:
        if block["type"] == "tool_use":
            return block["input"]
    return {}


async def process_cv(file_bytes: bytes, file_name: str, job_id: uuid.UUID | None, db: AsyncSession) -> dict:
    """Full pipeline: extract → OCR → PII → parse → embed → save candidate."""
    # 1. Extract text
    result = extract(file_bytes, file_name)

    # 2. OCR if scanned
    if result.is_scanned:
        result.text = _ocr_scanned_pdf(file_bytes)

    # 3. PII filter
    masked_text, pii_data = filter_pii(result.text)

    # 4. Parse CV
    structured = _parse_cv_text(masked_text)

    # 5. Generate embedding
    embed_text = " ".join(structured.get("skills", [])) + " " + " ".join(
        e.get("role", "") for e in structured.get("experience", [])
    )
    embedding = get_embedding(embed_text) if embed_text.strip() else None

    # 6. Save candidate
    candidate = Candidate(
        job_id=job_id,
        structured_data=structured,
        embedding=embedding,
        source_app_version="web",
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    return {
        "candidate_id": str(candidate.id),
        "file_name": file_name,
        "page_count": result.page_count,
        "is_scanned": result.is_scanned,
        "pii_detected": {k: len(v) for k, v in pii_data.items()},
        "structured_data": structured,
    }
