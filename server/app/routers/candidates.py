import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, User
from app.schemas import CandidateCreate, CandidateRead

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    candidate = Candidate(**data.model_dump())
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


@router.get("", response_model=list[CandidateRead])
async def list_candidates(
    job_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Candidate).order_by(Candidate.created_at.desc())
    if job_id:
        q = q.where(Candidate.job_id == job_id)
    if status_filter:
        q = q.where(Candidate.status == status_filter)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{candidate_id}", response_model=CandidateRead)
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.patch("/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: uuid.UUID,
    new_status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    valid = {"new", "reviewed", "approved", "rejected", "talent_pool"}
    if new_status not in valid:
        raise HTTPException(400, f"Status must be one of: {valid}")
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.status = new_status
    await db.commit()
    return {"id": candidate.id, "status": new_status}
