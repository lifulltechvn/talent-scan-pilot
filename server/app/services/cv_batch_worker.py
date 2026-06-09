"""Background worker for batch CV processing."""
import hashlib
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.extractor import extract
from app.models import Candidate
from app.pii_filter import filter_pii
from app.services.cv_upload import CV_UPLOAD_DIR, _background_ai_task

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=2)


def _get_session_factory():
    engine = create_async_engine(settings.DATABASE_URL, pool_size=5)
    return async_sessionmaker(engine, expire_on_commit=False)


def start_batch_processing(batch_id: str):
    """Kick off background processing for a batch."""
    import asyncio

    def _run():
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_process_batch(batch_id))
        loop.close()

    _executor.submit(_run)


async def _process_batch(batch_id: str):
    """Process all pending items in a batch."""
    session_factory = _get_session_factory()

    async with session_factory() as db:
        items = await db.execute(text(
            "SELECT id, file_path, file_name, file_hash FROM cv_batch_items WHERE batch_id = :bid AND status = 'pending'"
        ), {"bid": batch_id})
        rows = items.mappings().all()

    for row in rows:
        await _process_item(session_factory, batch_id, row)

    # Update batch status
    async with session_factory() as db:
        counts = await db.execute(text("""
            SELECT
                count(*) FILTER (WHERE status IN ('done', 'duplicate', 'skipped', 'error')) as processed,
                count(*) FILTER (WHERE status = 'duplicate') as duplicates,
                count(*) FILTER (WHERE status = 'error') as errors
            FROM cv_batch_items WHERE batch_id = :bid
        """), {"bid": batch_id})
        c = counts.mappings().first()
        total = await db.execute(text("SELECT total_files FROM cv_batches WHERE id = :bid"), {"bid": batch_id})
        t = total.scalar()
        status = "done" if c["processed"] >= t else "processing"

        await db.execute(text("""
            UPDATE cv_batches SET processed = :p, duplicates = :d, errors = :e, status = :s WHERE id = :bid
        """), {"p": c["processed"], "d": c["duplicates"], "e": c["errors"], "s": status, "bid": batch_id})
        await db.commit()


async def _process_item(session_factory, batch_id: str, row):
    """Process a single batch item."""
    item_id = str(row["id"])
    file_path = row["file_path"]
    file_name = row["file_name"]
    file_hash = row["file_hash"]

    try:
        async with session_factory() as db:
            # Check duplicate by hash
            existing = await db.execute(text(
                "SELECT id, structured_data->>'name' as name FROM candidates WHERE cv_hash = :h"
            ), {"h": file_hash})
            dup = existing.mappings().first()

            if dup:
                await db.execute(text("""
                    UPDATE cv_batch_items SET status = 'duplicate', duplicate_of = :dup_id WHERE id = :id
                """), {"dup_id": str(dup["id"]), "id": item_id})
                await _update_batch_counts(db, batch_id)
                await db.commit()
                return

            # Extract and process
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            result = extract(file_bytes, file_name)
            masked_text, pii_data = filter_pii(result.text)

            # Save to CV_UPLOAD_DIR
            candidate_id = uuid.uuid4()
            ext = os.path.splitext(file_name)[1].lower()
            stored_filename = f"{candidate_id}{ext}"
            dest = os.path.join(CV_UPLOAD_DIR, stored_filename)
            os.makedirs(CV_UPLOAD_DIR, exist_ok=True)
            with open(dest, "wb") as f:
                f.write(file_bytes)

            # Create candidate
            candidate = Candidate(
                id=candidate_id,
                job_id=None,
                structured_data={"name": file_name, "status": "processing"},
                embedding=None,
                cv_file_path=stored_filename,
                cv_hash=file_hash,
                source_app_version="web",
                status="processing",
            )
            db.add(candidate)
            await db.commit()

            # Update batch item
            await db.execute(text("""
                UPDATE cv_batch_items SET status = 'done', candidate_id = :cid WHERE id = :id
            """), {"cid": str(candidate_id), "id": item_id})
            await _update_batch_counts(db, batch_id)
            await db.commit()

            # AI processing in background
            _background_ai_task(str(candidate_id), masked_text, result.is_scanned, file_bytes if result.is_scanned else None)

    except Exception as e:
        logger.error(f"Batch item {item_id} failed: {e}")
        async with session_factory() as db:
            await db.execute(text(
                "UPDATE cv_batch_items SET status = 'error', error = :err WHERE id = :id"
            ), {"err": str(e)[:500], "id": item_id})
            await _update_batch_counts(db, batch_id)
            await db.commit()


async def _update_batch_counts(db, batch_id: str):
    """Update batch progress counts."""
    await db.execute(text("""
        UPDATE cv_batches SET
            processed = (SELECT count(*) FROM cv_batch_items WHERE batch_id = :bid AND status IN ('done', 'duplicate', 'skipped', 'error')),
            duplicates = (SELECT count(*) FROM cv_batch_items WHERE batch_id = :bid AND status = 'duplicate'),
            errors = (SELECT count(*) FROM cv_batch_items WHERE batch_id = :bid AND status = 'error')
        WHERE id = :bid
    """), {"bid": batch_id})


def process_single_item(item_id: str, file_path: str, file_name: str, file_hash: str, force: bool = False, update_id: str | None = None):
    """Re-process a single item (for duplicate resolution)."""
    import asyncio

    async def _run():
        session_factory = _get_session_factory()
        async with session_factory() as db:
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            result = extract(file_bytes, file_name)
            masked_text, pii_data = filter_pii(result.text)

            if update_id:
                # Update existing candidate
                candidate_id = uuid.UUID(update_id)
                ext = os.path.splitext(file_name)[1].lower()
                stored_filename = f"{candidate_id}{ext}"
                dest = os.path.join(CV_UPLOAD_DIR, stored_filename)
                with open(dest, "wb") as f2:
                    f2.write(file_bytes)
                await db.execute(text("""
                    UPDATE candidates SET cv_file_path = :fp, cv_hash = :h, status = 'processing',
                        structured_data = jsonb_set(structured_data, '{status}', '"processing"')
                    WHERE id = :cid
                """), {"fp": stored_filename, "h": file_hash, "cid": str(candidate_id)})
                await db.execute(text(
                    "UPDATE cv_batch_items SET status = 'done', candidate_id = :cid WHERE id = :id"
                ), {"cid": str(candidate_id), "id": item_id})
            else:
                # Create new
                candidate_id = uuid.uuid4()
                ext = os.path.splitext(file_name)[1].lower()
                stored_filename = f"{candidate_id}{ext}"
                dest = os.path.join(CV_UPLOAD_DIR, stored_filename)
                with open(dest, "wb") as f2:
                    f2.write(file_bytes)
                candidate = Candidate(
                    id=candidate_id, job_id=None,
                    structured_data={"name": file_name, "status": "processing"},
                    embedding=None, cv_file_path=stored_filename, cv_hash=file_hash,
                    source_app_version="web", status="processing",
                )
                db.add(candidate)
                await db.execute(text(
                    "UPDATE cv_batch_items SET status = 'done', candidate_id = :cid WHERE id = :id"
                ), {"cid": str(candidate_id), "id": item_id})

            await db.commit()
            _background_ai_task(str(candidate_id), masked_text, result.is_scanned, file_bytes if result.is_scanned else None)

    def _thread():
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_run())
        loop.close()

    _executor.submit(_thread)
