"""Interviews API — CRUD for calendar events + feedback."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/interviews", tags=["interviews"])


class InterviewCreate(BaseModel):
    candidate_id: str
    job_id: str | None = None
    title: str
    start_time: str  # ISO
    end_time: str    # ISO
    notes: str | None = None


class InterviewUpdate(BaseModel):
    title: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    notes: str | None = None
    status: str | None = None


class FeedbackCreate(BaseModel):
    score: int  # 1-5
    notes: str | None = None
    decision: str  # pass / fail / next_round


@router.get("")
async def list_interviews(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all interviews as calendar events."""
    rows = await db.execute(text("""
        SELECT i.*, c.structured_data->>'name' as candidate_name, j.title as job_title
        FROM interviews i
        LEFT JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN jobs j ON j.id = i.job_id
        ORDER BY i.start_time
    """))
    return [
        {
            "id": str(r["id"]),
            "candidate_id": str(r["candidate_id"]),
            "candidate_name": r["candidate_name"] or "Unknown",
            "job_id": str(r["job_id"]) if r["job_id"] else None,
            "job_title": r["job_title"],
            "title": r["title"],
            "start_time": r["start_time"].isoformat(),
            "end_time": r["end_time"].isoformat(),
            "notes": r["notes"],
            "status": r["status"],
            "feedback_score": r["feedback_score"],
            "feedback_notes": r["feedback_notes"],
            "feedback_decision": r["feedback_decision"],
        }
        for r in rows.mappings().all()
    ]


@router.post("", status_code=201)
async def create_interview(
    body: InterviewCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new interview event."""
    from datetime import datetime as dt
    interview_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO interviews (id, candidate_id, job_id, title, start_time, end_time, notes, created_by)
        VALUES (:id, :cid, :jid, :title, :start, :end, :notes, :uid)
    """), {
        "id": str(interview_id), "cid": body.candidate_id,
        "jid": body.job_id, "title": body.title,
        "start": dt.fromisoformat(body.start_time), "end": dt.fromisoformat(body.end_time),
        "notes": body.notes, "uid": str(user.id),
    })
    await db.commit()
    return {"id": str(interview_id), "status": "scheduled"}


@router.put("/{interview_id}")
async def update_interview(
    interview_id: uuid.UUID,
    body: InterviewUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update an interview (reschedule, change status)."""
    sets = []
    params = {"id": str(interview_id)}
    if body.title: sets.append("title = :title"); params["title"] = body.title
    if body.start_time: sets.append("start_time = :start"); params["start"] = body.start_time
    if body.end_time: sets.append("end_time = :end"); params["end"] = body.end_time
    if body.notes is not None: sets.append("notes = :notes"); params["notes"] = body.notes
    if body.status: sets.append("status = :status"); params["status"] = body.status
    if not sets:
        raise HTTPException(400, "Nothing to update")
    await db.execute(text(f"UPDATE interviews SET {', '.join(sets)} WHERE id = :id"), params)
    await db.commit()
    return {"status": "updated"}


@router.post("/{interview_id}/feedback")
async def add_feedback(
    interview_id: uuid.UUID,
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add feedback after an interview."""
    await db.execute(text("""
        UPDATE interviews SET feedback_score = :score, feedback_notes = :notes,
            feedback_decision = :decision, status = 'completed'
        WHERE id = :id
    """), {"score": body.score, "notes": body.notes, "decision": body.decision, "id": str(interview_id)})
    await db.commit()
    return {"status": "feedback_added"}


@router.delete("/{interview_id}")
async def delete_interview(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel/delete an interview."""
    await db.execute(text("DELETE FROM interviews WHERE id = :id"), {"id": str(interview_id)})
    await db.commit()
    return {"status": "deleted"}
