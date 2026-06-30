import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="hr")  # admin / hr / interviewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    required_skills: Mapped[list] = mapped_column(JSONB, default=list)
    required_skills_expanded: Mapped[list] = mapped_column(JSONB, default=list, nullable=True)
    required_years: Mapped[int | None] = mapped_column(nullable=True)
    required_education: Mapped[str | None] = mapped_column(String(50), nullable=True)
    salary_range: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)  # application_engineer / bridge_se / qa_engineer / admin / hr
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    embedding = mapped_column(Vector(1024), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    candidates = relationship("Candidate", back_populates="job", foreign_keys="[Candidate.job_id]")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id"))
    structured_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    embedding = mapped_column(Vector(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="new")  # new / reviewed / assigned / pending / approved / rejected
    match_score: Mapped[float | None] = mapped_column(Float)
    cv_file_path: Mapped[str | None] = mapped_column(String(500))
    cv_hash: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_app_version: Mapped[str | None] = mapped_column(String(20))
    source_job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    job = relationship("Job", back_populates="candidates", foreign_keys=[job_id])
    score = relationship("Score", back_populates="candidate", uselist=False)


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id"), unique=True)
    rule_score: Mapped[float | None] = mapped_column(Float)
    llm_score: Mapped[float | None] = mapped_column(Float)
    final_score: Mapped[float | None] = mapped_column(Float)
    classification: Mapped[str | None] = mapped_column(String(20))  # gold / silver / bronze
    details: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", back_populates="score")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[str | None] = mapped_column(String(50))
    details: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class OutreachLog(Base):
    __tablename__ = "outreach_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id"))
    to_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    template_type: Mapped[str] = mapped_column(String(30))  # outreach / rejection / reminder
    subject: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="sent")  # sent / failed / pending
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate")
    job = relationship("Job")


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id: Mapped[str] = mapped_column(String(100))  # e.g. "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    feature: Mapped[str] = mapped_column(String(50))  # scoring / outreach / parsing / embedding / ocr
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="server")  # server / desktop
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id"))
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id"))
    interviewer: Mapped[str] = mapped_column(String(100))
    round: Mapped[int] = mapped_column(Integer, default=1)
    rating: Mapped[int] = mapped_column(Integer)  # 1-5
    decision: Mapped[str] = mapped_column(String(20))  # pass / fail / next_round
    strengths: Mapped[str | None] = mapped_column(Text)
    weaknesses: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate")
    job = relationship("Job")


class JobCandidate(Base):
    __tablename__ = "job_candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    similarity_score: Mapped[float] = mapped_column(Float, default=0.0)
    skill_score: Mapped[float] = mapped_column(Float, default=0.0)
    combined_score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="suggested")  # suggested/assigned/scored/approved/rejected
    final_score: Mapped[float | None] = mapped_column(Float)
    classification: Mapped[str | None] = mapped_column(String(20))
    details: Mapped[dict | None] = mapped_column(JSONB)
    matched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job")
    candidate = relationship("Candidate")


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_type: Mapped[str] = mapped_column(String(30), unique=True)  # outreach / rejection / reminder
    greeting: Mapped[str] = mapped_column(Text, default="")
    body: Mapped[str] = mapped_column(Text, default="")
    closing: Mapped[str] = mapped_column(Text, default="")
    highlights: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tips: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CvBatch(Base):
    __tablename__ = "cv_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    duplicates: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="processing")
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items = relationship("CvBatchItem", back_populates="batch")


class CvBatchItem(Base):
    __tablename__ = "cv_batch_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cv_batches.id", ondelete="CASCADE"))
    file_name: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(500))
    file_hash: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("candidates.id"))
    duplicate_of: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("candidates.id"))
    error: Mapped[str | None] = mapped_column(Text)

    batch = relationship("CvBatch", back_populates="items")


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(255))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    interviewer_emails: Mapped[list | None] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    feedback_score: Mapped[int | None] = mapped_column(Integer)
    feedback_notes: Mapped[str | None] = mapped_column(Text)
    feedback_decision: Mapped[str | None] = mapped_column(String(20))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate")
    job = relationship("Job")
    interviewers = relationship("User", secondary="interview_interviewers", lazy="selectin")


class InterviewInterviewer(Base):
    __tablename__ = "interview_interviewers"

    interview_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
