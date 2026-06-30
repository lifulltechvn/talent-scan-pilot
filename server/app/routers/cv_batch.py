"""CV Batch Upload: upload files first, process in background."""
import hashlib
import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services.cv_upload import CV_UPLOAD_DIR

router = APIRouter(prefix="/cv/batch", tags=["cv-batch"])

BATCH_UPLOAD_DIR = os.path.join(CV_UPLOAD_DIR, "batches")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per file

MAGIC_BYTES = {".pdf": b"%PDF", ".docx": b"PK\x03\x04"}


@router.post("/upload")
async def batch_upload(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    target_job_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload multiple CV files. Saves to disk immediately, processing happens later."""
    if len(files) > 200:
        raise HTTPException(400, "Maximum 200 files per batch")

    batch_id = uuid.uuid4()
    batch_dir = os.path.join(BATCH_UPLOAD_DIR, str(batch_id))
    os.makedirs(batch_dir, exist_ok=True)

    # Create batch record
    await db.execute(text("""
        INSERT INTO cv_batches (id, total_files, status, created_by, target_job_id)
        VALUES (:id, :total, 'processing', :uid, :tjid)
    """), {"id": str(batch_id), "total": len(files), "uid": str(user.id), "tjid": target_job_id})

    # Save each file and create batch item
    for f in files:
        ext = "." + (f.filename or "file").rsplit(".", 1)[-1].lower()
        if ext not in (".pdf", ".docx"):
            continue
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            continue  # Skip oversized files
        expected_magic = MAGIC_BYTES.get(ext)
        if not expected_magic or not content[:len(expected_magic)] == expected_magic:
            continue  # Skip files with invalid content
        file_hash = hashlib.md5(content).hexdigest()
        item_id = uuid.uuid4()
        stored_name = f"{item_id}{ext}"
        file_path = os.path.join(batch_dir, stored_name)
        with open(file_path, "wb") as fp:
            fp.write(content)

        await db.execute(text("""
            INSERT INTO cv_batch_items (id, batch_id, file_name, file_path, file_hash, status)
            VALUES (:id, :bid, :fname, :fpath, :fhash, 'pending')
        """), {"id": str(item_id), "bid": str(batch_id), "fname": f.filename, "fpath": file_path, "fhash": file_hash})

    try:
        await db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Batch commit failed: {e}")
        raise HTTPException(500, "Failed to save batch")

    # Start background processing
    from app.services.cv_batch_worker import run_batch_sync
    background_tasks.add_task(run_batch_sync, str(batch_id), target_job_id)

    return {"batch_id": str(batch_id), "total_files": len(files), "status": "processing"}


@router.get("/latest")
async def get_latest_batch(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the most recent batch for this user."""
    result = await db.execute(text(
        "SELECT id FROM cv_batches WHERE created_by = :uid ORDER BY created_at DESC LIMIT 1"
    ), {"uid": str(user.id)})
    row = result.scalar_one_or_none()
    if not row:
        return None
    # Reuse the detail endpoint logic
    return await get_batch_status(uuid.UUID(str(row)), db, user)


@router.get("/{batch_id}")
async def get_batch_status(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get batch processing progress."""
    batch = await db.execute(text(
        "SELECT * FROM cv_batches WHERE id = :id"
    ), {"id": str(batch_id)})
    b = batch.mappings().first()
    if not b:
        raise HTTPException(404, "Batch not found")

    items = await db.execute(text("""
        SELECT bi.id, bi.file_name, bi.status, bi.candidate_id, bi.duplicate_of, bi.error,
               bi.duplicate_reason, bi.duplicate_details,
               c.structured_data->>'name' as candidate_name,
               dc.structured_data->>'name' as duplicate_name,
               dc.status as duplicate_status
        FROM cv_batch_items bi
        LEFT JOIN candidates c ON c.id = bi.candidate_id
        LEFT JOIN candidates dc ON dc.id = bi.duplicate_of
        WHERE bi.batch_id = :bid
        ORDER BY bi.file_name
    """), {"bid": str(batch_id)})

    item_list = []
    for i in items.mappings().all():
        item_list.append({
            "id": str(i["id"]),
            "file_name": i["file_name"],
            "status": i["status"],
            "candidate_id": str(i["candidate_id"]) if i["candidate_id"] else None,
            "candidate_name": i["candidate_name"],
            "duplicate_of": str(i["duplicate_of"]) if i["duplicate_of"] else None,
            "duplicate_name": i["duplicate_name"],
            "duplicate_reason": i["duplicate_reason"],
            "duplicate_details": i["duplicate_details"],
            "duplicate_status": i["duplicate_status"],
            "error": i["error"],
        })

    return {
        "batch_id": str(b["id"]),
        "total_files": b["total_files"],
        "processed": b["processed"],
        "duplicates": b["duplicates"],
        "errors": b["errors"],
        "status": b["status"],
        "created_at": str(b["created_at"]),
        "items": item_list,
    }


@router.post("/{batch_id}/items/{item_id}/resolve")
async def resolve_duplicate(
    batch_id: uuid.UUID,
    item_id: uuid.UUID,
    action: str,  # "update" or "create_new" or "skip"
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Resolve a duplicate item: update existing, create new, or skip."""
    item = await db.execute(text(
        "SELECT * FROM cv_batch_items WHERE id = :id AND batch_id = :bid"
    ), {"id": str(item_id), "bid": str(batch_id)})
    row = item.mappings().first()
    if not row:
        raise HTTPException(404, "Item not found")

    if action == "skip":
        await db.execute(text("UPDATE cv_batch_items SET status = 'skipped' WHERE id = :id"), {"id": str(item_id)})
        await db.commit()
        return {"status": "skipped"}

    # Re-process with force or update
    from app.services.cv_batch_worker import process_single_item
    update_id = str(row["duplicate_of"]) if action == "update" else None

    # If updating a rejected candidate → reset to reviewed + add timeline log
    if action == "update" and row["duplicate_of"]:
        cand = await db.execute(text("SELECT status FROM candidates WHERE id = :id"), {"id": str(row["duplicate_of"])})
        cand_row = cand.mappings().first()
        if cand_row and cand_row["status"] == "rejected":
            await db.execute(text("UPDATE candidates SET status = 'reviewed' WHERE id = :id"), {"id": str(row["duplicate_of"])})
            await db.execute(text("""
                INSERT INTO timeline_events (id, candidate_id, event_type, description, created_at)
                VALUES (gen_random_uuid(), :cid, 'reopened', 'Ứng viên được mở lại sau khi bị reject — CV mới được upload', now())
            """), {"cid": str(row["duplicate_of"])})
            await db.commit()

    process_single_item(str(item_id), row["file_path"], row["file_name"], row["file_hash"], force=True, update_id=update_id)

    return {"status": "processing"}


@router.post("/{batch_id}/resolve-all")
async def resolve_all_duplicates(
    batch_id: uuid.UUID,
    action: str,  # "update_all" or "create_all" or "skip_all"
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Resolve all duplicate items in batch at once."""
    items = await db.execute(text(
        "SELECT * FROM cv_batch_items WHERE batch_id = :bid AND status = 'duplicate'"
    ), {"bid": str(batch_id)})

    from app.services.cv_batch_worker import process_single_item

    for row in items.mappings().all():
        if action == "skip_all":
            await db.execute(text("UPDATE cv_batch_items SET status = 'skipped' WHERE id = :id"), {"id": str(row["id"])})
        elif action == "update_all":
            # Reset rejected candidates
            if row["duplicate_of"]:
                cand = await db.execute(text("SELECT status FROM candidates WHERE id = :id"), {"id": str(row["duplicate_of"])})
                cand_row = cand.mappings().first()
                if cand_row and cand_row["status"] == "rejected":
                    await db.execute(text("UPDATE candidates SET status = 'reviewed' WHERE id = :id"), {"id": str(row["duplicate_of"])})
            process_single_item(str(row["id"]), row["file_path"], row["file_name"], row["file_hash"], force=True, update_id=str(row["duplicate_of"]))
        elif action == "create_all":
            process_single_item(str(row["id"]), row["file_path"], row["file_name"], row["file_hash"], force=True, update_id=None)

    await db.commit()
    return {"status": "processing", "count": items.rowcount}
