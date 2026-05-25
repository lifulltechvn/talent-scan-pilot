from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, Quiz, ScheduleBooking, ScheduleSlot, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/action-items")
async def get_action_items(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_end = now.replace(hour=23, minute=59, second=59)
    tomorrow_end = today_end + timedelta(days=1)
    stale_threshold = now - timedelta(days=3)

    # 1. Unreviewed candidates (status=new)
    new_candidates_q = await db.execute(
        select(Candidate)
        .where(Candidate.status == "new")
        .order_by(Candidate.created_at.desc())
        .limit(10)
    )
    new_candidates = new_candidates_q.scalars().all()

    # 2. Stale candidates (status=new, older than 3 days)
    stale_q = await db.execute(
        select(func.count()).select_from(Candidate)
        .where(Candidate.status == "new", Candidate.created_at < stale_threshold)
    )
    stale_count = stale_q.scalar() or 0

    # 3. Quizzes expiring within 24h
    expiring_quizzes_q = await db.execute(
        select(Quiz)
        .options(joinedload(Quiz.candidate), joinedload(Quiz.job))
        .where(Quiz.status == "pending", Quiz.deadline <= tomorrow_end, Quiz.deadline > now)
        .order_by(Quiz.deadline.asc())
        .limit(10)
    )
    expiring_quizzes = expiring_quizzes_q.scalars().all()

    # 4. Quizzes submitted (awaiting HR review)
    submitted_quizzes_q = await db.execute(
        select(Quiz)
        .options(joinedload(Quiz.candidate), joinedload(Quiz.job))
        .where(Quiz.status == "submitted")
        .order_by(Quiz.created_at.desc())
        .limit(10)
    )
    submitted_quizzes = submitted_quizzes_q.scalars().all()

    # 5. Interviews today/tomorrow
    upcoming_bookings_q = await db.execute(
        select(ScheduleBooking)
        .options(joinedload(ScheduleBooking.slot).joinedload(ScheduleSlot.job), joinedload(ScheduleBooking.candidate))
        .where(ScheduleBooking.status == "booked")
        .where(ScheduleBooking.slot.has(ScheduleSlot.slot_start <= tomorrow_end))
        .where(ScheduleBooking.slot.has(ScheduleSlot.slot_start >= now))
        .order_by(ScheduleBooking.booked_at.asc())
        .limit(10)
    )
    upcoming_bookings = upcoming_bookings_q.scalars().all()

    # 6. Pending booking links (candidate hasn't picked slot yet)
    pending_bookings_q = await db.execute(
        select(func.count()).select_from(ScheduleBooking)
        .where(ScheduleBooking.status == "pending")
    )
    pending_bookings_count = pending_bookings_q.scalar() or 0

    # 7. Jobs with deadline approaching (within 3 days)
    expiring_jobs_q = await db.execute(
        select(Job)
        .where(Job.deadline != None, Job.deadline <= now + timedelta(days=3), Job.deadline > now)  # noqa: E711
        .order_by(Job.deadline.asc())
        .limit(5)
    )
    expiring_jobs = expiring_jobs_q.scalars().all()

    return {
        "unreviewed_candidates": [
            {
                "id": str(c.id),
                "name": c.structured_data.get("name", "Unknown"),
                "created_at": c.created_at.isoformat(),
                "job_id": str(c.job_id) if c.job_id else None,
            }
            for c in new_candidates
        ],
        "unreviewed_count": len(new_candidates),
        "stale_count": stale_count,
        "expiring_quizzes": [
            {
                "id": str(q.id),
                "candidate_name": q.candidate.structured_data.get("name", "Unknown") if q.candidate else "Unknown",
                "job_title": q.job.title if q.job else "",
                "deadline": q.deadline.isoformat(),
            }
            for q in expiring_quizzes
        ],
        "submitted_quizzes": [
            {
                "id": str(q.id),
                "candidate_id": str(q.candidate_id),
                "candidate_name": q.candidate.structured_data.get("name", "Unknown") if q.candidate else "Unknown",
                "job_title": q.job.title if q.job else "",
            }
            for q in submitted_quizzes
        ],
        "upcoming_interviews": [
            {
                "id": str(b.id),
                "candidate_name": b.candidate.structured_data.get("name", "Unknown") if b.candidate else "Unknown",
                "job_title": b.slot.job.title if b.slot and b.slot.job else "",
                "slot_start": b.slot.slot_start.isoformat() if b.slot else None,
                "slot_end": b.slot.slot_end.isoformat() if b.slot else None,
            }
            for b in upcoming_bookings
        ],
        "pending_bookings_count": pending_bookings_count,
        "expiring_jobs": [
            {
                "id": str(j.id),
                "title": j.title,
                "deadline": j.deadline.isoformat() if j.deadline else None,
            }
            for j in expiring_jobs
        ],
    }
