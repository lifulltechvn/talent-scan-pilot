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


def start_scheduler():
    scheduler.add_job(send_interview_reminders, "interval", hours=1, id="interview_reminders", replace_existing=True)
    scheduler.start()
