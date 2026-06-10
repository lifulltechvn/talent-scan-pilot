"""Initial schema - all tables

Revision ID: 0001
Revises:
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Users table (may already exist with data)
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            hashed_password VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")

    # Jobs
    op.create_table(
        "jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("required_skills", JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("required_years", sa.Integer, nullable=True),
        sa.Column("required_education", sa.String(50), nullable=True),
        sa.Column("salary_range", sa.String(255), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("embedding", Vector(1024), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Candidates
    op.create_table(
        "candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("structured_data", JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("embedding", Vector(1024), nullable=True),
        sa.Column("status", sa.String(50), server_default=sa.text("'new'")),
        sa.Column("match_score", sa.Float, nullable=True),
        sa.Column("cv_file_path", sa.String(500), nullable=True),
        sa.Column("cv_hash", sa.String(32), nullable=True),
        sa.Column("source_app_version", sa.String(20), nullable=True),
        sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Scores
    op.create_table(
        "scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), unique=True, nullable=False),
        sa.Column("rule_score", sa.Float, nullable=True),
        sa.Column("llm_score", sa.Float, nullable=True),
        sa.Column("final_score", sa.Float, nullable=True),
        sa.Column("classification", sa.String(20), nullable=True),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Job Candidates (Smart Pool)
    op.create_table(
        "job_candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("similarity_score", sa.Float, server_default="0.0"),
        sa.Column("skill_score", sa.Float, server_default="0.0"),
        sa.Column("combined_score", sa.Float, server_default="0.0"),
        sa.Column("status", sa.String(20), server_default=sa.text("'suggested'")),
        sa.Column("final_score", sa.Float, nullable=True),
        sa.Column("classification", sa.String(20), nullable=True),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("matched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Audit Logs
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(50), nullable=True),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Quizzes
    op.create_table(
        "quizzes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("token", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'")),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("credibility_score", sa.Float, nullable=True),
        sa.Column("ai_evaluation", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Quiz Questions
    op.create_table(
        "quiz_questions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quiz_id", UUID(as_uuid=True), sa.ForeignKey("quizzes.id"), nullable=False),
        sa.Column("question_type", sa.String(30), nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("options", JSONB, nullable=True),
        sa.Column("purpose", sa.Text, nullable=True),
        sa.Column("eval_criteria", sa.Text, nullable=True),
        sa.Column("sort_order", sa.Integer, server_default="0"),
    )

    # Quiz Responses
    op.create_table(
        "quiz_responses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("question_id", UUID(as_uuid=True), sa.ForeignKey("quiz_questions.id"), nullable=False),
        sa.Column("answer", sa.Text, nullable=False),
        sa.Column("verdict", sa.String(20), nullable=True),
        sa.Column("verdict_reason", sa.Text, nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Schedule Slots
    op.create_table(
        "schedule_slots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("slot_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slot_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_candidates", sa.Integer, server_default="1"),
        sa.Column("booked_count", sa.Integer, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Schedule Bookings
    op.create_table(
        "schedule_bookings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("slot_id", UUID(as_uuid=True), sa.ForeignKey("schedule_slots.id"), nullable=True),
        sa.Column("token", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'")),
        sa.Column("reminder_sent", sa.Boolean, server_default="false"),
        sa.Column("booked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Outreach Logs
    op.create_table(
        "outreach_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("to_email", sa.String(255), nullable=True),
        sa.Column("template_type", sa.String(30), nullable=False),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'sent'")),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # AI Usage Logs
    op.create_table(
        "ai_usage_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_id", sa.String(100), nullable=False),
        sa.Column("feature", sa.String(50), nullable=False),
        sa.Column("input_tokens", sa.Integer, server_default="0"),
        sa.Column("output_tokens", sa.Integer, server_default="0"),
        sa.Column("cost_usd", sa.Float, server_default="0.0"),
        sa.Column("source", sa.String(20), server_default=sa.text("'server'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Interview Feedback
    op.create_table(
        "interview_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("interviewer", sa.String(100), nullable=False),
        sa.Column("round", sa.Integer, server_default="1"),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("strengths", sa.Text, nullable=True),
        sa.Column("weaknesses", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Email Templates
    op.create_table(
        "email_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("template_type", sa.String(30), unique=True, nullable=False),
        sa.Column("greeting", sa.Text, server_default=sa.text("''")),
        sa.Column("body", sa.Text, server_default=sa.text("''")),
        sa.Column("closing", sa.Text, server_default=sa.text("''")),
        sa.Column("highlights", JSONB, nullable=True),
        sa.Column("tips", JSONB, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


    # CV Batches
    op.create_table(
        "cv_batches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("total_files", sa.Integer, server_default="0"),
        sa.Column("processed", sa.Integer, server_default="0"),
        sa.Column("duplicates", sa.Integer, server_default="0"),
        sa.Column("errors", sa.Integer, server_default="0"),
        sa.Column("status", sa.String(20), server_default=sa.text("'processing'")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # CV Batch Items
    op.create_table(
        "cv_batch_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("cv_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_hash", sa.String(32), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("duplicate_of", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("error", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("cv_batch_items")
    op.drop_table("cv_batches")
    op.drop_table("email_templates")
    op.drop_table("interview_feedback")
    op.drop_table("ai_usage_logs")
    op.drop_table("outreach_logs")
    op.drop_table("schedule_bookings")
    op.drop_table("schedule_slots")
    op.drop_table("quiz_responses")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
    op.drop_table("audit_logs")
    op.drop_table("job_candidates")
    op.drop_table("scores")
    op.drop_table("candidates")
    op.drop_table("jobs")
    op.drop_table("users")
