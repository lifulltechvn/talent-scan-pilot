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
                    # Re-trigger background AI parsing
                    from app.services.cv_upload import _background_ai_task
                    _background_ai_task(str(candidate.id), candidate.cv_file_path)
                    logger.info(f"Re-queued candidate {str(candidate.id)[:8]}")
                else:
                    # No CV file — mark as error
                    candidate.status = "new"
                    logger.warning(f"Candidate {str(candidate.id)[:8]} has no CV file, reset to 'new'")

            await db.commit()
            logger.info(f"Task recovery complete: {len(stuck)} candidates re-queued")
    except Exception as e:
        logger.error(f"Task recovery failed: {e}")
