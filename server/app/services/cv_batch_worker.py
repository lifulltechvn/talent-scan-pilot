"""Background worker for batch CV processing."""
import asyncio
import hashlib
import json
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
from app.services.cv_upload import CV_UPLOAD_DIR

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=15)


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

    # Collect items for Phase 2 enrichment (after all Phase 1 done)
    _post_items: list = []

    # Process items in TRUE parallel using thread pool (not asyncio)
    from concurrent.futures import as_completed
    futures = []
    for row in rows:
        f = _executor.submit(_process_item_sync, batch_id, dict(row), _post_items)
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
        status = "done" if t and c["processed"] >= t else "processing"

        await db.execute(text("""
            UPDATE cv_batches SET processed = :p, duplicates = :d, errors = :e, status = :s WHERE id = :bid
        """), {"p": c["processed"], "d": c["duplicates"], "e": c["errors"], "s": status, "bid": batch_id})
        await db.commit()

    # Phase 2: Background enrichment (after ALL items done — no Bedrock contention with Phase 1)
    if _post_items:
        import threading
        def _run_enrichment():
            import asyncio as _aio, json as _json
            from app.services.cv_upload import _parse_cv_enrichment, get_embedding
            from app.skill_maps import SKILL_MAPS
            from app.services.cv_translate import translate_candidate_background

            async def _enrich_one(cid, cv_text, base_sd):
                from sqlalchemy.ext.asyncio import create_async_engine as _ce, async_sessionmaker as _asm
                from sqlalchemy import text as _text
                _eng = _ce(settings.DATABASE_URL, pool_size=1)
                _sf = _asm(_eng, expire_on_commit=False)
                try:
                    enriched = _parse_cv_enrichment(cv_text, cid)
                    sd = dict(base_sd)
                    if enriched.get("experience"): sd["experience"] = enriched["experience"]
                    if enriched.get("education"): sd["education"] = enriched["education"]
                    if enriched.get("certifications"): sd["certifications"] = enriched["certifications"]
                    if enriched.get("languages"): sd["languages"] = enriched["languages"]
                    sd["insight"] = {"strengths": enriched.get("strengths", ""), "weaknesses": enriched.get("weaknesses", "")}
                    # Keep Phase 1 skill_level category/level, but update reason from Phase 2
                    sl = enriched.get("skill_level")
                    if sl and isinstance(sl, dict) and sl.get("reason") and sd.get("skill_level"):
                        sd["skill_level"]["reason"] = {"en": sl.get("reason_en", sl.get("reason", "")), "vi": sl.get("reason_vi", "")}
                    emb = get_embedding(" ".join(sd.get("skills", [])), candidate_id=cid)
                    async with _sf() as _db:
                        await _db.execute(_text(
                            "UPDATE candidates SET structured_data = :sd, embedding = :emb WHERE id = :id"
                        ), {"sd": _json.dumps(sd, ensure_ascii=False), "emb": str(emb) if emb else None, "id": cid})
                        await _db.commit()
                    translate_candidate_background(cid, sd)
                    # Match candidate to jobs (needs embedding)
                    from app.services.smart_pool import background_match_candidate
                    background_match_candidate(cid)
                except Exception as e:
                    logger.warning(f"Enrichment failed {cid}: {e}")
                finally:
                    await _eng.dispose()

            def _worker(cid, cv_text, base_sd):
                loop = _aio.new_event_loop()
                try:
                    loop.run_until_complete(_enrich_one(cid, cv_text, base_sd))
                except Exception:
                    pass
                finally:
                    loop.close()

            from concurrent.futures import ThreadPoolExecutor as _TP, as_completed as _ac
            with _TP(max_workers=5) as pool:
                futs = [pool.submit(_worker, cid, txt, sd) for cid, txt, sd in _post_items]
                for f in _ac(futs):
                    try: f.result()
                    except Exception: pass
        threading.Thread(target=_run_enrichment, daemon=True).start()


def _process_item_sync(batch_id: str, row: dict, _post_items: list):
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
        engine = create_async_engine(settings.DATABASE_URL, pool_size=2, max_overflow=3)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sf() as db:
                # Check duplicate by hash (prioritize blacklist detection)
                existing = await db.execute(text(
                    "SELECT id, structured_data->>'name' as name, status FROM candidates WHERE cv_hash = :h"
                ), {"h": file_hash})
                dup = existing.mappings().first()

                if dup:
                    reason = 'blacklisted' if dup["status"] == 'blacklisted' else 'hash_match'
                    details = json.dumps({"existing_name": dup.get("name", ""), "existing_status": dup["status"]})
                    await db.execute(text("""
                        UPDATE cv_batch_items SET status = 'duplicate', duplicate_of = :dup_id, duplicate_reason = :reason, duplicate_details = CAST(:details AS jsonb) WHERE id = :id
                    """), {"dup_id": str(dup["id"]), "reason": reason, "details": details, "id": item_id})
                    await db.commit()
                    print(f"[TIMING] {file_name}: {reason} {time.time()-t0:.1f}s", flush=True)
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

                # Update candidate (done — fast path, enrichment in background)
                from sqlalchemy import update as sql_update
                await db.execute(
                    sql_update(Candidate).where(Candidate.id == candidate_id)
                    .values(structured_data=structured, status="new")
                )
                await db.execute(text("UPDATE cv_batch_items SET status = 'done' WHERE id = :id"), {"id": item_id})
                await db.commit()

                # Post-processing: enrich + embed + translate (all background)
                # Store for batch-level post-processing (after ALL items done)
                _post_items.append((str(candidate_id), masked_text, structured))

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
    """Re-process a single item (for duplicate resolution). Reuses same flow as batch."""
    import asyncio

    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from app.config import settings
        engine = create_async_engine(settings.DATABASE_URL, pool_size=2, max_overflow=3)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        async with sf() as db:
            try:
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
            except Exception as e:
                await db.execute(text("UPDATE cv_batch_items SET status = 'error', error = :err WHERE id = :id"), {"err": str(e)[:200], "id": item_id})
                await db.commit()
                await engine.dispose()
                return

            result = extract(file_bytes, file_name)
            masked_text, pii_data = filter_pii(result.text)

            if update_id:
                candidate_id = uuid.UUID(update_id)
                stored_filename = f"{candidate_id}{os.path.splitext(file_name)[1].lower()}"
                dest = os.path.join(CV_UPLOAD_DIR, stored_filename)
                with open(dest, "wb") as f2:
                    f2.write(file_bytes)
                await db.execute(text("UPDATE candidates SET cv_file_path = :fp, cv_hash = :h, status = 'processing' WHERE id = :cid"),
                    {"fp": stored_filename, "h": file_hash, "cid": str(candidate_id)})
            else:
                candidate_id = uuid.uuid4()
                stored_filename = f"{candidate_id}{os.path.splitext(file_name)[1].lower()}"
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
                await db.flush()

            # Phase 1: Parse (name, skills, G-level)
            from app.services.cv_upload import _process_ai_sync, _parse_cv_enrichment, get_embedding
            structured, _ = _process_ai_sync(masked_text, str(candidate_id))
            if pii_data:
                if pii_data.get("email"): structured["email"] = pii_data["email"][0]
                if pii_data.get("phone"): structured["phone"] = pii_data["phone"][0]

            # Save Phase 1 + mark done
            from sqlalchemy import update as sql_update
            await db.execute(sql_update(Candidate).where(Candidate.id == candidate_id).values(structured_data=structured, status="new"))
            await db.execute(text("UPDATE cv_batch_items SET status = 'done', candidate_id = :cid WHERE id = :id"), {"cid": str(candidate_id), "id": item_id})
            await db.commit()

            # Phase 2: Enrichment (background, same DB session pattern)
            try:
                enriched = _parse_cv_enrichment(masked_text, str(candidate_id))
                if enriched.get("experience"): structured["experience"] = enriched["experience"]
                if enriched.get("education"): structured["education"] = enriched["education"]
                if enriched.get("certifications"): structured["certifications"] = enriched["certifications"]
                if enriched.get("languages"): structured["languages"] = enriched["languages"]
                structured["insight"] = {"strengths": enriched.get("strengths", ""), "weaknesses": enriched.get("weaknesses", "")}
                # Keep Phase 1 skill_level category/level, but update reason from Phase 2
                sl = enriched.get("skill_level")
                if sl and isinstance(sl, dict) and sl.get("reason") and structured.get("skill_level"):
                    structured["skill_level"]["reason"] = {"en": sl.get("reason_en", sl.get("reason", "")), "vi": sl.get("reason_vi", "")}
                emb = get_embedding(" ".join(structured.get("skills", [])), candidate_id=str(candidate_id))
                await db.execute(text("UPDATE candidates SET structured_data = :sd, embedding = :emb WHERE id = :id"),
                    {"sd": json.dumps(structured, ensure_ascii=False), "emb": str(emb) if emb else None, "id": str(candidate_id)})
                await db.commit()
            except Exception as e2:
                logger.warning(f"Enrichment failed for {candidate_id}: {e2}")

            # Translate + Match
            from app.services.cv_translate import translate_candidate_background
            translate_candidate_background(str(candidate_id), structured)
            from app.services.smart_pool import background_match_candidate
            background_match_candidate(str(candidate_id))

        await engine.dispose()

    def _thread():
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_run())
        except Exception as e:
            logger.error(f"process_single_item failed for {item_id}: {e}")
        finally:
            loop.close()

    _executor.submit(_thread)
