"""Recover stuck tasks on server startup."""
import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Candidate

logger = logging.getLogger(__name__)


async def recover_stuck_tasks():
    """Find candidates stuck in 'processing' status and re-queue them."""
    try:
        async with async_session() as db:
            result = await db.execute(
                select(Candidate).where(Candidate.status == "processing")
            )
            stuck = result.scalars().all()

            if not stuck:
                return

            logger.info(f"Found {len(stuck)} stuck candidates in 'processing' state. Re-queuing...")

            for candidate in stuck:
                if candidate.cv_file_path:
                    # Re-extract text from CV file and re-trigger AI parsing
                    import os
                    from app.services.cv_upload import CV_UPLOAD_DIR, _background_ai_task
                    from app.extractor import extract as extract_cv
                    from app.pii_filter import filter_pii

                    file_path = os.path.join(CV_UPLOAD_DIR, candidate.cv_file_path)
                    if os.path.exists(file_path):
                        try:
                            with open(file_path, "rb") as f:
                                file_bytes = f.read()
                            result_ext = extract_cv(file_bytes, candidate.cv_file_path)
                            masked_text, pii_data = filter_pii(result_ext.text)
                            _background_ai_task(str(candidate.id), masked_text, result_ext.is_scanned, file_bytes if result_ext.is_scanned else None, pii_data)
                            logger.info(f"Re-queued candidate {str(candidate.id)[:8]}")
                        except Exception as e:
                            candidate.status = "new"
                            logger.warning(f"Re-queue failed for {str(candidate.id)[:8]}: {e}")
                    else:
                        candidate.status = "new"
                        logger.warning(f"Candidate {str(candidate.id)[:8]} CV file missing, reset to 'new'")
                else:
                    candidate.status = "new"
                    logger.warning(f"Candidate {str(candidate.id)[:8]} has no CV file, reset to 'new'")

            await db.commit()
            logger.info(f"Task recovery complete: {len(stuck)} candidates handled")
    except Exception as e:
        logger.error(f"Task recovery failed: {e}")
