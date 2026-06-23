"""Background worker for batch CV processing."""
import asyncio
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
_executor = ThreadPoolExecutor(max_workers=20)


_engine = None
_session_factory = None


async def recover_stale_batches():
    """Re-process batches stuck in 'processing' state (e.g., after server restart)."""
    from app.database import async_session as main_session
    async with main_session() as db:
        result = await db.execute(text(
            "SELECT id FROM cv_batches WHERE status = 'processing'"
        ))
        stale = [str(r[0]) for r in result.all()]
    for batch_id in stale:
        logger.info(f"Recovering stale batch: {batch_id}")
        start_batch_processing(batch_id)

def _get_session_factory():
    global _engine, _session_factory
    if _session_factory is None:
        _engine = create_async_engine(settings.DATABASE_URL, pool_size=20, max_overflow=10)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _session_factory


def start_batch_processing(batch_id: str):
    """Kick off background processing for a batch."""
    import asyncio
    import threading

    def _run():
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_process_batch(batch_id))
        loop.close()

    threading.Thread(target=_run, daemon=True).start()


async def run_batch_sync(batch_id: str):
    """Run batch processing (called from FastAPI BackgroundTasks)."""
    await _process_batch(batch_id)


async def _process_batch(batch_id: str):
    """Process all pending items in a batch."""
    session_factory = _get_session_factory()

    async with session_factory() as db:
        items = await db.execute(text(
            "SELECT id, file_path, file_name, file_hash FROM cv_batch_items WHERE batch_id = :bid AND status = 'pending'"
        ), {"bid": batch_id})
        rows = items.mappings().all()

    # Process items in TRUE parallel using thread pool (not asyncio)
    from concurrent.futures import as_completed
    futures = []
    for row in rows:
        f = _executor.submit(_process_item_sync, batch_id, dict(row))
        futures.append(f)

    # Wait for all to complete
    for f in as_completed(futures):
        try:
            f.result()
        except Exception as e:
            logger.error(f"Batch item failed: {e}")

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


def _process_item_sync(batch_id: str, row: dict):
    """Process a single batch item SYNCHRONOUSLY in its own thread."""
    import time
    import asyncio

    t0 = time.time()
    item_id = str(row["id"])
    file_path = row["file_path"]
    file_name = row["file_name"]
    file_hash = row["file_hash"]

    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sf() as db:
                # Check duplicate by hash
                existing = await db.execute(text(
                    "SELECT id, structured_data->>'name' as name FROM candidates WHERE cv_hash = :h"
                ), {"h": file_hash})
                dup = existing.mappings().first()

                if dup:
                    await db.execute(text("""
                        UPDATE cv_batch_items SET status = 'duplicate', duplicate_of = :dup_id, duplicate_reason = 'hash_match' WHERE id = :id
                    """), {"dup_id": str(dup["id"]), "id": item_id})
                    await db.commit()
                    print(f"[TIMING] {file_name}: DUP {time.time()-t0:.1f}s", flush=True)
                    return

                # Extract
                t1 = time.time()
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                result = extract(file_bytes, file_name)
                masked_text, pii_data = filter_pii(result.text)
                print(f"[TIMING] {file_name}: extract {time.time()-t1:.1f}s", flush=True)

                # Save candidate
                candidate_id = uuid.uuid4()
                ext = os.path.splitext(file_name)[1].lower()
                stored_filename = f"{candidate_id}{ext}"
                dest = os.path.join(CV_UPLOAD_DIR, stored_filename)
                os.makedirs(CV_UPLOAD_DIR, exist_ok=True)
                with open(dest, "wb") as f2:
                    f2.write(file_bytes)

                candidate = Candidate(
                    id=candidate_id, job_id=None,
                    structured_data={"name": file_name, "status": "processing"},
                    embedding=None, cv_file_path=stored_filename, cv_hash=file_hash,
                    source_app_version="web", status="processing",
                )
                db.add(candidate)
                await db.flush()  # Ensure candidate is persisted before FK reference
                await db.execute(text(
                    "UPDATE cv_batch_items SET status = 'processing', candidate_id = :cid WHERE id = :id"
                ), {"cid": str(candidate_id), "id": item_id})
                await db.commit()

                # AI processing (blocking in this thread — that's fine, each item has its own thread)
                t2 = time.time()
                from app.services.cv_upload import _process_ai_sync, _extract_avatar
                structured, embedding = _process_ai_sync(masked_text, str(candidate_id))
                print(f"[TIMING] {file_name}: AI {time.time()-t2:.1f}s TOTAL={time.time()-t0:.1f}s", flush=True)

                # Inject PII back
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

                # Extract avatar
                if file_bytes:
                    avatar = _extract_avatar(file_bytes, str(candidate_id))
                    if avatar:
                        structured["avatar"] = avatar

                # Update candidate (done — fast path)
                from sqlalchemy import update as sql_update
                await db.execute(
                    sql_update(Candidate).where(Candidate.id == candidate_id)
                    .values(structured_data=structured, embedding=embedding, status="new")
                )
                await db.execute(text("UPDATE cv_batch_items SET status = 'done' WHERE id = :id"), {"id": item_id})
                await db.commit()

                # Post-processing (non-blocking, doesn't affect scan speed)
                def _post_process():
                    import asyncio as _aio
                    async def _run_post():
                        from sqlalchemy.ext.asyncio import create_async_engine as _ce, async_sessionmaker as _asm
                        _eng = _ce(settings.DATABASE_URL, pool_size=1)
                        _sf = _asm(_eng, expire_on_commit=False)
                        try:
                            # Skill level assessment
                            from app.skill_maps import assess_skill_level
                            skill_level = assess_skill_level(structured, candidate_id=str(candidate_id))
                            if skill_level:
                                async with _sf() as _db:
                                    from sqlalchemy import update as _su
                                    sd = dict(structured)
                                    sd["skill_level"] = skill_level
                                    await _db.execute(_su(Candidate).where(Candidate.id == candidate_id).values(structured_data=sd))
                                    await _db.commit()
                        except Exception:
                            pass
                        finally:
                            await _eng.dispose()
                    _loop = _aio.new_event_loop()
                    try:
                        _loop.run_until_complete(_run_post())
                    except Exception:
                        pass
                    finally:
                        _loop.close()
                import threading
                threading.Thread(target=_post_process, daemon=True).start()

                # Background translation EN → VI (with retry)
                from app.services.cv_translate import translate_candidate_background
                translate_candidate_background(str(candidate_id), structured)

                # Smart pool
                from app.services.smart_pool import background_match_candidate
                background_match_candidate(str(candidate_id))

        except Exception as e:
            logger.error(f"_process_item_sync {item_id} failed: {e}")
            try:
                async with sf() as db2:
                    await db2.execute(text("UPDATE cv_batch_items SET status = 'error', error = :err WHERE id = :id"), {"err": str(e)[:500], "id": item_id})
                    await db2.commit()
            except Exception:
                pass
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run())
    finally:
        loop.close()


async def _update_batch_counts(db, batch_id: str):
    """Update batch progress counts and notify via WebSocket."""
    await db.execute(text("""
        UPDATE cv_batches SET
            processed = (SELECT count(*) FROM cv_batch_items WHERE batch_id = :bid AND status IN ('done', 'duplicate', 'skipped', 'error')),
            duplicates = (SELECT count(*) FROM cv_batch_items WHERE batch_id = :bid AND status = 'duplicate'),
            errors = (SELECT count(*) FROM cv_batch_items WHERE batch_id = :bid AND status = 'error'),
            status = CASE WHEN (SELECT count(*) FROM cv_batch_items WHERE batch_id = :bid AND status IN ('pending', 'processing')) = 0 THEN 'done' ELSE 'processing' END
        WHERE id = :bid
    """), {"bid": batch_id})

    # Get current counts for WebSocket notification
    result = await db.execute(text(
        "SELECT total_files, processed, duplicates, errors, status FROM cv_batches WHERE id = :bid"
    ), {"bid": batch_id})
    row = result.mappings().first()
    if row:
        from app.ws_manager import notify_progress
        notify_progress(batch_id, {
            "type": "progress",
            "total": row["total_files"],
            "processed": row["processed"],
            "duplicates": row["duplicates"],
            "errors": row["errors"],
            "status": row["status"],
        })


def process_single_item(item_id: str, file_path: str, file_name: str, file_hash: str, force: bool = False, update_id: str | None = None):
    """Re-process a single item (for duplicate resolution)."""
    import asyncio

    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from app.config import settings
        engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        async with sf() as db:
            try:
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
            except Exception as e:
                logger.error(f"process_single_item: cannot read file {file_path}: {e}")
                async with sf() as db2:
                    await db2.execute(text("UPDATE cv_batch_items SET status = 'error', error = :err WHERE id = :id"), {"err": str(e)[:200], "id": item_id})
                    await db2.commit()
                return

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
        await engine.dispose()

    def _thread():
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_run())
        except Exception as e:
            logger.error(f"process_single_item thread failed for {item_id}: {e}")
        finally:
            loop.close()

    _executor.submit(_thread)
