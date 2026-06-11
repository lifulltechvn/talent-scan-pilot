"""Scheduled tasks — interview reminders, talent pool re-match."""

from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.database import async_session_factory
from app.models import ScheduleBooking, ScheduleSlot, Candidate, Job
from app.services.email import get_email_service
from app.services.email_templates import default_reminder, render_reminder

scheduler = AsyncIOScheduler()


async def send_interview_reminders():
    """Send reminder emails 24h before scheduled interviews."""
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)

    async with async_session_factory() as db:
        result = await db.execute(
            select(ScheduleBooking)
            .join(ScheduleSlot)
            .options(selectinload(ScheduleBooking.slot), selectinload(ScheduleBooking.candidate))
            .where(and_(
                ScheduleSlot.slot_start >= window_start,
                ScheduleSlot.slot_start <= window_end,
                ScheduleBooking.status == "booked",
                ScheduleBooking.reminder_sent == False,
            ))
        )
        bookings = result.scalars().all()

        email_service = get_email_service()
        for booking in bookings:
            candidate = booking.candidate
            slot = booking.slot
            if not candidate or not slot:
                continue

            job = await db.get(Job, slot.job_id)
            name = candidate.structured_data.get("name", "Candidate")
            email = candidate.structured_data.get("email", "")
            if not email:
                continue

            job_title = job.title if job else "Interview"
            date_str = slot.slot_start.strftime("%A, %B %d, %Y")
            time_str = f"{slot.slot_start.strftime('%I:%M %p')} — {slot.slot_end.strftime('%I:%M %p')}"

            sections = default_reminder(name, job_title, date_str, time_str)
            subject, html = render_reminder(sections)

            try:
                email_service.send(to=email, subject=subject, html_body=html)
                booking.reminder_sent = True
            except Exception:
                pass

        await db.commit()


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
    scheduler.add_job(send_interview_reminders, "interval", hours=1, id="interview_reminders", replace_existing=True)
    scheduler.add_job(send_30min_reminders, "interval", minutes=5, id="30min_reminders", replace_existing=True)
    scheduler.start()
