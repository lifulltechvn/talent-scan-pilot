"""CV Upload router: POST /api/v1/cv/upload + batch status + duplicate check."""
import hashlib
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.extractor import SUPPORTED_EXTENSIONS
from app.models import Candidate, User
from app.services.cv_upload import process_cv

router = APIRouter(prefix="/cv", tags=["cv-upload"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    force: str = Form("false"),
    update_candidate_id: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a single CV file. Returns immediately; AI processes in background."""
    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type. Allowed: {', '.join(SUPPORTED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Max 10MB.")

    file_hash = hashlib.md5(content).hexdigest()

    # Check exact file duplicate (same hash)
    if force != "true" and not update_candidate_id:
        result = await db.execute(
            select(Candidate).where(Candidate.cv_hash == file_hash)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return {
                "duplicate": True,
                "duplicate_type": "exact_file",
                "existing_candidate": {
                    "id": str(existing.id),
                    "name": existing.structured_data.get("name", "Unknown"),
                    "uploaded_at": str(existing.created_at),
                },
                "message": "CV này đã được upload trước đó",
            }

    # Update existing candidate
    if update_candidate_id:
        return await process_cv(content, file.filename or "unknown", db, file_hash=file_hash, update_id=update_candidate_id)

    return await process_cv(content, file.filename or "unknown", db, file_hash=file_hash)


@router.post("/check-duplicate")
async def check_duplicate_by_name(
    name: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Check if a candidate with similar name already exists."""
    result = await db.execute(
        text("SELECT id, structured_data, created_at FROM candidates WHERE structured_data->>'name' ILIKE :name AND status != 'processing'"),
        {"name": f"%{name}%"},
    )
    matches = [
        {"id": str(r["id"]), "name": r["structured_data"].get("name", ""), "uploaded_at": str(r["created_at"])}
        for r in result.mappings().all()
    ]
    return {"matches": matches}


@router.get("/upload/status")
async def batch_status(
    ids: str = Query(..., description="Comma-separated candidate IDs"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Poll processing status for multiple candidates at once."""
    id_list = [uuid.UUID(i.strip()) for i in ids.split(",") if i.strip()]
    result = await db.execute(
        select(Candidate.id, Candidate.status, Candidate.structured_data)
        .where(Candidate.id.in_(id_list))
    )
    return [
        {"candidate_id": str(r.id), "status": r.status, "structured_data": r.structured_data}
        for r in result.all()
    ]
