"""User management API — admin only."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.database import get_db
from app.deps import require_role
from app.models import User

router = APIRouter(prefix="/users", tags=["users"])


class CreateUserBody(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "interviewer"


class UpdateUserBody(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


@router.get("")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "hr")),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [{"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active} for u in users]


@router.post("", status_code=201)
async def create_user(
    body: CreateUserBody,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "hr")),
):
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if body.role not in ("admin", "hr", "interviewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role}


@router.put("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserBody,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "hr")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None:
        target.full_name = body.full_name
    if body.role is not None:
        if body.role not in ("admin", "hr", "interviewer"):
            raise HTTPException(status_code=400, detail="Invalid role")
        target.role = body.role
    if body.is_active is not None:
        target.is_active = body.is_active
    await db.commit()
    return {"id": str(target.id), "email": target.email, "full_name": target.full_name, "role": target.role, "is_active": target.is_active}


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == _user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.delete(target)
    await db.commit()
    return {"status": "deleted"}


@router.get("/interviewers")
async def list_interviewers(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("admin", "hr")),
):
    """List users with role=interviewer (for dropdown in interview form)."""
    result = await db.execute(select(User).where(User.role == "interviewer", User.is_active == True))
    return [{"id": str(u.id), "email": u.email, "full_name": u.full_name} for u in result.scalars().all()]
