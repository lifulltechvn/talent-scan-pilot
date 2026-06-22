"""CV Upload service: extract → OCR → PII → parse → embed → save."""
import asyncio
import base64
import json
import logging
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.bedrock import get_bedrock_client, get_embedding, _log_usage
from app.config import settings
from app.extractor import extract
from app.models import Candidate
from app.pii_filter import filter_pii

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=4)

CV_UPLOAD_DIR = "/app/uploads/cv"
AVATAR_DIR = "/app/uploads/avatars"


def _extract_avatar(file_bytes: bytes, candidate_id: str) -> str | None:
    """Extract first image from PDF as candidate avatar. Returns filename or None."""
    try:
        import fitz
        os.makedirs(AVATAR_DIR, exist_ok=True)
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc[:2]:  # check first 2 pages
            images = page.get_images()
            for img_ref in images:
                xref = img_ref[0]
                pix = fitz.Pixmap(doc, xref)
                if pix.width < 150 or pix.height < 150:
                    continue  # skip small images (icons, logos, bullets)
                # Likely a portrait photo if aspect ratio is roughly square/portrait
                ratio = pix.width / max(pix.height, 1)
                if ratio > 1.5 or ratio < 0.5:
                    continue  # skip banners, wide logos
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                filename = f"{candidate_id}.jpg"
                # Resize if too large
                if pix.width > 300 or pix.height > 300:
                    scale = 300 / max(pix.width, pix.height)
                    mat = fitz.Matrix(scale, scale)
                    pix = fitz.Pixmap(pix, 0) if pix.alpha else pix
                pix.save(os.path.join(AVATAR_DIR, filename))
                return filename
        return None
    except Exception:
        return None


def _clean_text(text: str) -> str:
    """Remove excessive whitespace/formatting to reduce tokens."""
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'[─━═▪•●◦▸►]{2,}', '', text)
    return text.strip()


def _ocr_scanned_pdf(file_bytes: bytes, candidate_id: str | None = None) -> str:
    """OCR a scanned PDF using Claude Sonnet Vision."""
    client = get_bedrock_client()
    b64 = base64.b64encode(file_bytes).decode()
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
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
    _log_usage(settings.BEDROCK_MODEL_SONNET, "ocr", usage.get("input_tokens", 0), usage.get("output_tokens", 0), candidate_id=candidate_id)
    return result["content"][0]["text"]


def _parse_cv_text(text: str, candidate_id: str | None = None) -> dict:
    """Parse CV text into structured data using Claude Haiku with tool_use."""
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
                "experience": {"type": "array", "items": {"type": "object", "properties": {"company": {"type": "string"}, "role": {"type": "string"}, "duration": {"type": "string"}, "description": {"type": "string"}}}},
                "education": {"type": "array", "items": {"type": "object", "properties": {"school": {"type": "string"}, "degree": {"type": "string"}, "major": {"type": "string"}, "year": {"type": "string"}}}},
                "certifications": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "issuer": {"type": "string"}}}},
                "languages": {"type": "array", "items": {"type": "object", "properties": {"language": {"type": "string"}, "level": {"type": "string"}}}},
                "experience_years": {"type": "number"},
                "insight": {"type": "object", "properties": {"strengths": {"type": "string"}, "weaknesses": {"type": "string"}}},
            },
            "required": ["name", "skills", "experience", "education", "experience_years"],
        },
    }]
    from app.prompts import CV_PARSE_SYSTEM, CV_PARSE_USER
    from app.injection_guard import sanitize_for_llm

    cleaned = _clean_text(text)[:2500]
    safe_text = sanitize_for_llm(cleaned, "CV_CONTENT")
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "temperature": 0,
        "system": CV_PARSE_SYSTEM,
        "messages": [{"role": "user", "content": CV_PARSE_USER.format(text=safe_text)}],
        "tools": tools,
        "tool_choice": {"type": "tool", "name": "save_cv_data"},
    }
    response = client.invoke_model(modelId=settings.BEDROCK_MODEL_HAIKU, body=json.dumps(body))
    result = json.loads(response["body"].read())
    usage = result.get("usage", {})
    _log_usage(settings.BEDROCK_MODEL_HAIKU, "cv_parsing", usage.get("input_tokens", 0), usage.get("output_tokens", 0), candidate_id=candidate_id)
    for block in result["content"]:
        if block["type"] == "tool_use":
            return block["input"]
    return {}


def _process_ai_sync(masked_text: str, candidate_id: str | None = None) -> tuple[dict, list[float] | None]:
    """Run AI parsing + embedding. Parse first, then embed with structured data."""
    from app.cv_validator import validate_and_normalize

    # Step 1: Parse CV
    structured = _parse_cv_text(masked_text, candidate_id)
    structured, confidence = validate_and_normalize(structured)
    logger.info(f"CV parsed: {structured.get('name', '?')}, confidence: {confidence:.0%}, skills: {len(structured.get('skills', []))}")

    # Step 2: Embed with structured data (better quality than raw text)
    skills_text = " ".join(structured.get("skills", []))
    roles_text = " ".join(e.get("role", "") for e in structured.get("experience", [])[:3])
    embed_input = f"{roles_text} {skills_text}".strip() or masked_text[:500]
    try:
        embedding = get_embedding(embed_input, candidate_id=candidate_id)
    except Exception:
        embedding = None

    return structured, embedding


def _background_ai_task(candidate_id: str, masked_text: str, is_scanned: bool, file_bytes: bytes | None, pii_data: dict | None = None):
    """Background: run AI parsing + embedding, then update candidate in DB.
    Note: PII (email/phone) is injected AFTER AI parsing — AI never sees real PII."""
    import threading

    def _run():
        try:
            text = masked_text
            if is_scanned and file_bytes:
                text = _ocr_scanned_pdf(file_bytes, candidate_id=candidate_id)

            structured, embedding = _process_ai_sync(text, candidate_id=candidate_id)

            # Inject real PII back AFTER AI parsing (AI only saw masked text)
            if pii_data:
                if pii_data.get("email"):
                    structured["email"] = pii_data["email"][0]
                if pii_data.get("phone"):
                    structured["phone"] = pii_data["phone"][0]
                if pii_data.get("url"):
                    structured["profile_urls"] = pii_data["url"]
                if pii_data.get("address"):
                    structured["address"] = pii_data["address"][0]
                if pii_data.get("dob"):
                    structured["date_of_birth"] = pii_data["dob"][0]

            # Extract avatar from PDF
            if file_bytes:
                avatar = _extract_avatar(file_bytes, candidate_id)
                if avatar:
                    structured["avatar"] = avatar

            # Assess skill level based on skill maps
            from app.skill_maps import assess_skill_level
            skill_level = assess_skill_level(structured, candidate_id=candidate_id)
            if skill_level:
                structured["skill_level"] = skill_level

            # Update candidate in DB
            async def _update():
                engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
                factory = async_sessionmaker(engine, expire_on_commit=False)
                async with factory() as db:
                    from sqlalchemy import update
                    await db.execute(
                        update(Candidate)
                        .where(Candidate.id == uuid.UUID(candidate_id))
                        .values(structured_data=structured, embedding=embedding, status="new")
                    )
                    await db.commit()
                await engine.dispose()

            loop = asyncio.new_event_loop()
            loop.run_until_complete(_update())
            loop.close()
            logger.info(f"Background AI done for candidate {candidate_id[:8]}")

            # Smart Pool: auto-match candidate to all jobs (separate thread + session)
            if embedding:
                from app.services.smart_pool import background_match_candidate
                background_match_candidate(candidate_id)
        except Exception as e:
            logger.error(f"Background AI failed for {candidate_id[:8]}: {e}")

    threading.Thread(target=_run, daemon=True).start()


async def process_cv(file_bytes: bytes, file_name: str, db: AsyncSession, file_hash: str = "", update_id: str | None = None, job_id=None) -> dict:
    """Fast pipeline: extract → PII → save file → save candidate → AI in background."""
    # 1. Extract text (fast, local)
    result = extract(file_bytes, file_name)

    # 2. PII filter (fast, regex)
    masked_text, pii_data = filter_pii(result.text)

    # 2b. Injection guard
    from app.injection_guard import guard
    masked_text, injection_warnings = guard(masked_text, "CV_CONTENT")
    if injection_warnings:
        logger.warning(f"Injection patterns detected in {file_name}: {injection_warnings}")

    # 3. Save CV file to disk
    if update_id:
        candidate_id = uuid.UUID(update_id)
    else:
        candidate_id = uuid.uuid4()
    ext = os.path.splitext(file_name)[1].lower()
    stored_filename = f"{candidate_id}{ext}"
    os.makedirs(CV_UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(CV_UPLOAD_DIR, stored_filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # 4. Save or update candidate
    if update_id:
        existing = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
        candidate = existing.scalar_one_or_none()
        if candidate:
            candidate.cv_file_path = stored_filename
            candidate.cv_hash = file_hash
            candidate.status = "processing"
            candidate.structured_data = {"name": candidate.structured_data.get("name", file_name), "status": "processing"}
            await db.commit()
            await db.refresh(candidate)
        else:
            return {"error": "Candidate not found"}
    else:
        candidate = Candidate(
            id=candidate_id,
            job_id=job_id,
            structured_data={"name": file_name, "status": "processing"},
            embedding=None,
            cv_file_path=stored_filename,
            cv_hash=file_hash,
            source_app_version="web",
            status="processing",
        )
        db.add(candidate)
        await db.commit()
        await db.refresh(candidate)

    # 5. Kick off AI parsing in background (pii_data injected after AI, never sent to AI)
    _background_ai_task(
        str(candidate.id), masked_text,
        result.is_scanned, file_bytes,
        pii_data=pii_data,
    )

    return {
        "candidate_id": str(candidate.id),
        "file_name": file_name,
        "page_count": result.page_count,
        "is_scanned": result.is_scanned,
        "pii_detected": {k: len(v) for k, v in pii_data.items()},
        "status": "processing",
    }


async def process_cv_sync(file_bytes: bytes, file_name: str, db: AsyncSession, job_id=None) -> dict:
    """Synchronous pipeline (waits for AI). Used when caller needs immediate result."""
    # 1. Extract text
    result = extract(file_bytes, file_name)

    # 2. OCR if scanned
    if result.is_scanned:
        loop = asyncio.get_event_loop()
        result.text = await loop.run_in_executor(_executor, _ocr_scanned_pdf, file_bytes)

    # 3. PII filter
    masked_text, pii_data = filter_pii(result.text)

    # 4+5. Parse CV + Embedding
    loop = asyncio.get_event_loop()
    structured, embedding = await loop.run_in_executor(_executor, _process_ai_sync, masked_text)

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
