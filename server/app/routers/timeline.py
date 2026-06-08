"""Candidate timeline + Interview feedback endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import (
    Candidate, InterviewFeedback, OutreachLog, Quiz, ScheduleBooking,
    ScheduleSlot, User,
)

router = APIRouter(tags=["candidates"])


# --- Timeline ---

class TimelineEvent(BaseModel):
    type: str  # scanned | scored | quiz_sent | quiz_submitted | interview_booked | email_sent | feedback
    title: str
    detail: str | None = None
    timestamp: str


@router.get("/candidates/{candidate_id}/timeline", response_model=list[TimelineEvent])
async def get_timeline(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    events: list[TimelineEvent] = []

    # CV scanned
    if candidate.created_at:
        events.append(TimelineEvent(type="scanned", title="CV Scanned", timestamp=candidate.created_at.isoformat()))

    # Scored
    from app.models import Score
    score_result = await db.execute(select(Score).where(Score.candidate_id == candidate_id))
    score = score_result.scalar_one_or_none()
    if score and score.created_at:
        events.append(TimelineEvent(type="scored", title="Scored", detail=f"Final: {score.final_score}", timestamp=score.created_at.isoformat()))

    # Quizzes
    quiz_result = await db.execute(select(Quiz).where(Quiz.candidate_id == candidate_id).order_by(Quiz.created_at))
    for quiz in quiz_result.scalars().all():
        events.append(TimelineEvent(type="quiz_sent", title="Quiz Sent", detail=quiz.reason, timestamp=quiz.created_at.isoformat()))
        if quiz.status == "submitted":
            events.append(TimelineEvent(type="quiz_submitted", title="Quiz Submitted", timestamp=quiz.created_at.isoformat()))

    # Interview bookings
    booking_result = await db.execute(
        select(ScheduleBooking).where(ScheduleBooking.candidate_id == candidate_id, ScheduleBooking.status == "booked")
    )
    for booking in booking_result.scalars().all():
        ts = booking.booked_at or booking.created_at
        events.append(TimelineEvent(type="interview_booked", title="Interview Booked", timestamp=ts.isoformat()))

    # Emails sent
    email_result = await db.execute(
        select(OutreachLog).where(OutreachLog.candidate_id == candidate_id, OutreachLog.status == "sent")
    )
    for log in email_result.scalars().all():
        events.append(TimelineEvent(type="email_sent", title=f"Email: {log.template_type}", detail=log.subject, timestamp=log.sent_at.isoformat()))

    # Feedback
    fb_result = await db.execute(select(InterviewFeedback).where(InterviewFeedback.candidate_id == candidate_id))
    for fb in fb_result.scalars().all():
        events.append(TimelineEvent(type="feedback", title=f"Feedback R{fb.round}", detail=f"{fb.decision} ({fb.rating}/5)", timestamp=fb.created_at.isoformat()))

    events.sort(key=lambda e: e.timestamp)
    return events


# --- Interview Feedback ---

class FeedbackCreate(BaseModel):
    candidate_id: str
    job_id: str | None = None
    interviewer: str
    round: int = 1
    rating: int  # 1-5
    decision: str  # pass / fail / next_round
    strengths: str | None = None
    weaknesses: str | None = None
    notes: str | None = None


class FeedbackOut(BaseModel):
    id: str
    candidate_id: str
    job_id: str | None
    interviewer: str
    round: int
    rating: int
    decision: str
    strengths: str | None
    weaknesses: str | None
    notes: str | None
    created_at: str


@router.post("/interviews/feedback", status_code=201, response_model=FeedbackOut)
async def create_feedback(
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    fb = InterviewFeedback(**body.model_dump())
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return FeedbackOut(
        id=str(fb.id), candidate_id=str(fb.candidate_id), job_id=str(fb.job_id) if fb.job_id else None,
        interviewer=fb.interviewer, round=fb.round, rating=fb.rating, decision=fb.decision,
        strengths=fb.strengths, weaknesses=fb.weaknesses, notes=fb.notes, created_at=fb.created_at.isoformat(),
    )


@router.get("/interviews/feedback/{candidate_id}", response_model=list[FeedbackOut])
async def get_feedback(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewFeedback).where(InterviewFeedback.candidate_id == candidate_id).order_by(InterviewFeedback.created_at.desc())
    )
    return [
        FeedbackOut(
            id=str(fb.id), candidate_id=str(fb.candidate_id), job_id=str(fb.job_id) if fb.job_id else None,
            interviewer=fb.interviewer, round=fb.round, rating=fb.rating, decision=fb.decision,
            strengths=fb.strengths, weaknesses=fb.weaknesses, notes=fb.notes, created_at=fb.created_at.isoformat(),
        )
        for fb in result.scalars().all()
    ]
