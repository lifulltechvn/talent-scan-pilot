"""CV Upload router: POST /api/v1/cv/upload."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.extractor import SUPPORTED_EXTENSIONS
from app.models import User
from app.services.cv_upload import process_cv

router = APIRouter(prefix="/cv", tags=["cv-upload"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    job_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload CV file, process pipeline, and create candidate."""
    # Validate extension
    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type. Allowed: {', '.join(SUPPORTED_EXTENSIONS)}")

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Max 10MB.")

    parsed_job_id = uuid.UUID(job_id) if job_id else None

    result = await process_cv(content, file.filename or "unknown", parsed_job_id, db)
    return result
