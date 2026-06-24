"""Scheduled tasks — interview reminders."""

from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database import async_session_factory
from app.services.email import get_email_service

scheduler = AsyncIOScheduler()


async def send_30min_reminders():
    """Send reminder 30 minutes before interviews (via interviews table)."""
    from sqlalchemy import text
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(minutes=25)
    window_end = now + timedelta(minutes=35)

    async with async_session_factory() as db:
        rows = await db.execute(text("""
            SELECT i.id, i.title, i.start_time, i.round, i.meeting_link,
                   c.structured_data->>'name' as candidate_name,
                   c.structured_data->>'email' as candidate_email,
                   j.title as job_title
            FROM interviews i
            JOIN candidates c ON c.id = i.candidate_id
            LEFT JOIN jobs j ON j.id = i.job_id
            WHERE i.status = 'scheduled'
              AND i.start_time >= :ws AND i.start_time <= :we
              AND i.reminder_30min_sent = FALSE
        """), {"ws": window_start, "we": window_end})

        interviews = rows.mappings().all()
        email_service = get_email_service()

        for iv in interviews:
            email = iv["candidate_email"]
            if not email:
                continue

            name = iv["candidate_name"] or "Candidate"
            job_title = iv["job_title"] or iv["title"]
            time_str = iv["start_time"].strftime("%H:%M")
            link = iv["meeting_link"] or ""
            round_num = iv["round"] or 1

            subject = f"⏰ Reminder: Interview Round {round_num} in 30 minutes — {job_title}"
            body = f"Hi {name},\n\nThis is a reminder that your Round {round_num} interview for {job_title} starts at {time_str}."
            if link:
                body += f"\n\nMeeting link: {link}"
            body += "\n\nGood luck!\nTalentScan Team"

            try:
                email_service.send(to=email, subject=subject, html_body=f"<pre>{body}</pre>")
                await db.execute(text("UPDATE interviews SET reminder_30min_sent = TRUE WHERE id = :id"), {"id": str(iv["id"])})
            except Exception:
                pass

        await db.commit()


def start_scheduler():
    scheduler.add_job(send_30min_reminders, "interval", minutes=5, id="30min_reminders", replace_existing=True)
    scheduler.add_job(_retry_translations, "interval", minutes=10, id="retry_translations", replace_existing=True)
    scheduler.add_job(_retry_skill_levels, "interval", minutes=5, id="retry_skill_levels", replace_existing=True)
    scheduler.start()


def _retry_translations():
    """Retry failed CV translations every 10 minutes."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.config import settings
    from app.services.cv_translate import retry_failed_translations

    async def _run():
        engine = create_async_engine(settings.DATABASE_URL, pool_size=2)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sf() as db:
                count = await retry_failed_translations(db)
                if count:
                    import logging
                    logging.getLogger(__name__).info(f"Retrying {count} failed translations")
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run())
    except Exception:
        pass
    finally:
        loop.close()


def _retry_skill_levels():
    """Assess skill level for candidates that don't have it yet."""
    import asyncio
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.config import settings
    from app.skill_maps import assess_skill_level

    async def _run():
        engine = create_async_engine(settings.DATABASE_URL, pool_size=2)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sf() as db:
                result = await db.execute(text("""
                    SELECT id, structured_data FROM candidates
                    WHERE structured_data->>'skill_level' IS NULL
                      AND structured_data->'skill_level' IS NULL
                      AND status != 'processing'
                      AND structured_data->>'name' IS NOT NULL
                      AND jsonb_array_length(COALESCE(structured_data->'skills', '[]'::jsonb)) > 0
                    LIMIT 5
                """))
                rows = result.mappings().all()
                if not rows:
                    return

                import logging, json
                logger = logging.getLogger(__name__)
                logger.info(f"Assessing skill level for {len(rows)} candidates")

                for row in rows:
                    try:
                        sd = row["structured_data"]
                        level = assess_skill_level(sd, candidate_id=str(row["id"]))
                        if level:
                            sd_copy = dict(sd)
                            sd_copy["skill_level"] = level
                            await db.execute(text(
                                "UPDATE candidates SET structured_data = :sd WHERE id = :id"
                            ), {"sd": json.dumps(sd_copy, ensure_ascii=False), "id": str(row["id"])})
                    except Exception as e:
                        logger.warning(f"Skill level assessment failed for {row['id']}: {e}")
                await db.commit()
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run())
    except Exception:
        pass
    finally:
        loop.close()
