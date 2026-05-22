import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, User
from app.schemas import JobCreate, JobRead, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


async def _rematch_talent_pool(job_id: str, required_skills: list[str]):
    """Re-match talent pool candidates against new job skills."""
    from app.database import async_session_factory

    async with async_session_factory() as db:
        result = await db.execute(
            select(Candidate).where(Candidate.status == "pool")
        )
        pool_candidates = result.scalars().all()

        required_set = {s.lower() for s in required_skills}
        for candidate in pool_candidates:
            candidate_skills = {s.lower() for s in candidate.structured_data.get("skills", [])}
            overlap = candidate_skills & required_set
            if len(overlap) >= 2:  # at least 2 matching skills
                candidate.match_score = len(overlap) / len(required_set) if required_set else 0
        await db.commit()


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: JobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = Job(**data.model_dump(), created_by=user.id)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(_rematch_talent_pool, str(job.id), data.required_skills)
    return job


@router.get("", response_model=list[JobRead])
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/{job_id}", response_model=JobRead)
async def update_job(
    job_id: uuid.UUID,
    data: JobUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(job, k, v)
    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(job)
    await db.commit()
