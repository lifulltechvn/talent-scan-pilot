"""Schedule endpoints — admin (create slots, create booking link) + public (view slots, book)."""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, ScheduleBooking, ScheduleSlot, User

router = APIRouter(prefix="/schedule", tags=["schedule"])


# --- Schemas ---

class SlotCreateRequest(BaseModel):
    job_id: str
    slot_start: str  # ISO datetime
    slot_end: str
    max_candidates: int = 1


class SlotOut(BaseModel):
    id: str
    slot_start: str
    slot_end: str
    max_candidates: int
    booked_count: int
    available: bool

    model_config = {"from_attributes": True}


class BookingCreateRequest(BaseModel):
    candidate_id: str
    job_id: str


class BookSlotRequest(BaseModel):
    slot_id: str


class SchedulePublicOut(BaseModel):
    job_title: str
    candidate_name: str
    slots: list[SlotOut]


# --- Admin endpoints ---

@router.post("/slots", status_code=status.HTTP_201_CREATED)
async def create_slot(
    body: SlotCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create an available interview time slot."""
    slot = ScheduleSlot(
        job_id=body.job_id,
        slot_start=datetime.fromisoformat(body.slot_start),
        slot_end=datetime.fromisoformat(body.slot_end),
        max_candidates=body.max_candidates,
        created_by=user.id,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return {"id": str(slot.id), "slot_start": slot.slot_start.isoformat(), "slot_end": slot.slot_end.isoformat()}


@router.post("/bookings/create-link", status_code=status.HTTP_201_CREATED)
async def create_booking_link(
    body: BookingCreateRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Create a scheduling link for a candidate (sent via outreach email)."""
    candidate = await db.get(Candidate, body.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    token = secrets.token_urlsafe(32)
    booking = ScheduleBooking(
        candidate_id=body.candidate_id,
        slot_id=None,
        token=token,
    )
    # Store job_id temporarily in a workaround — we'll query slots by job_id
    db.add(booking)
    await db.commit()
    return {"token": token, "url": f"/schedule/{token}"}


@router.get("/bookings", response_model=list)
async def list_bookings(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """List all bookings (admin view)."""
    result = await db.execute(
        select(ScheduleBooking)
        .options(selectinload(ScheduleBooking.slot), selectinload(ScheduleBooking.candidate))
        .order_by(ScheduleBooking.created_at.desc())
    )
    bookings = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "candidate_name": b.candidate.structured_data.get("name", "Unknown") if b.candidate else "Unknown",
            "slot_start": b.slot.slot_start.isoformat() if b.slot else None,
            "slot_end": b.slot.slot_end.isoformat() if b.slot else None,
            "status": b.status,
            "booked_at": b.booked_at.isoformat() if b.booked_at else None,
        }
        for b in bookings
    ]


# --- Public endpoints (token-based) ---

@router.get("/public/{token}", response_model=SchedulePublicOut)
async def get_public_schedule(token: str, db: AsyncSession = Depends(get_db)):
    """Public: candidate views available slots."""
    booking = await _get_booking_by_token(db, token)

    # Get available slots for the candidate's job
    candidate = await db.get(Candidate, booking.candidate_id)
    if not candidate or not candidate.job_id:
        raise HTTPException(status_code=404, detail="No job associated")

    job = await db.get(Job, candidate.job_id)

    result = await db.execute(
        select(ScheduleSlot)
        .where(ScheduleSlot.job_id == candidate.job_id)
        .where(ScheduleSlot.slot_start > datetime.now(timezone.utc))
        .where(ScheduleSlot.booked_count < ScheduleSlot.max_candidates)
        .order_by(ScheduleSlot.slot_start)
    )
    slots = result.scalars().all()

    return SchedulePublicOut(
        job_title=job.title if job else "Unknown",
        candidate_name=candidate.structured_data.get("name", "Candidate"),
        slots=[
            SlotOut(
                id=str(s.id),
                slot_start=s.slot_start.isoformat(),
                slot_end=s.slot_end.isoformat(),
                max_candidates=s.max_candidates,
                booked_count=s.booked_count,
                available=s.booked_count < s.max_candidates,
            )
            for s in slots
        ],
    )


@router.post("/public/{token}/book")
async def book_slot(token: str, body: BookSlotRequest, db: AsyncSession = Depends(get_db)):
    """Public: candidate selects a time slot."""
    booking = await _get_booking_by_token(db, token)

    if booking.status == "booked":
        raise HTTPException(status_code=400, detail="Already booked")

    slot = await db.get(ScheduleSlot, body.slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.booked_count >= slot.max_candidates:
        raise HTTPException(status_code=409, detail="Slot is full")

    slot.booked_count += 1
    booking.slot_id = slot.id
    booking.status = "booked"
    booking.booked_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "booked", "slot_start": slot.slot_start.isoformat(), "slot_end": slot.slot_end.isoformat()}


# --- Helpers ---

async def _get_booking_by_token(db: AsyncSession, token: str) -> ScheduleBooking:
    result = await db.execute(select(ScheduleBooking).where(ScheduleBooking.token == token))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking link not found")
    return booking
