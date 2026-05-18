import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


# --- Job ---
class JobCreate(BaseModel):
    title: str
    description: str
    required_skills: list[str] = []
    salary_range: Optional[str] = None
    location: Optional[str] = None
    deadline: Optional[datetime] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[list[str]] = None
    salary_range: Optional[str] = None
    location: Optional[str] = None
    deadline: Optional[datetime] = None


class JobRead(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    required_skills: list
    salary_range: Optional[str]
    location: Optional[str]
    deadline: Optional[datetime]
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Candidate ---
class CandidateCreate(BaseModel):
    job_id: Optional[uuid.UUID] = None
    structured_data: dict = {}
    source_app_version: Optional[str] = None
    scanned_at: Optional[datetime] = None


class CandidateRead(BaseModel):
    id: uuid.UUID
    job_id: Optional[uuid.UUID]
    structured_data: dict
    status: str
    match_score: Optional[float]
    source_app_version: Optional[str]
    scanned_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Score ---
class ScoreRead(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    rule_score: Optional[float]
    llm_score: Optional[float]
    final_score: Optional[float]
    classification: Optional[str]
    details: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}
