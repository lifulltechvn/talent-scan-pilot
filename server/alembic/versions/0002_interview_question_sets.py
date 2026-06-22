"""Add interview question sets and scores tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interview_question_sets",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID, sa.ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("round", sa.Integer, server_default=sa.text("1")),
        sa.Column("level", sa.String(20), server_default=sa.text("'mid'")),
        sa.Column("num_questions", sa.Integer, server_default=sa.text("8")),
        sa.Column("questions_en", JSONB, nullable=False),
        sa.Column("translations", JSONB, server_default=sa.text("'{}'")),
        sa.Column("is_template", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usage_count", sa.Integer, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_qs_lookup", "interview_question_sets", ["job_id", "round", "level"])

    op.create_table(
        "interview_question_scores",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("interview_id", UUID, sa.ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_set_id", UUID, sa.ForeignKey("interview_question_sets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scores", JSONB, nullable=False),
        sa.Column("custom_questions", JSONB, server_default=sa.text("'[]'")),
        sa.Column("total_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("max_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("percentage", sa.Numeric(5, 2), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_iqs_interview", "interview_question_scores", ["interview_id"], unique=True)

    # Add question_set_id reference to interviews table
    op.add_column("interviews", sa.Column("question_set_id", UUID, nullable=True))


def downgrade() -> None:
    op.drop_column("interviews", "question_set_id")
    op.drop_table("interview_question_scores")
    op.drop_table("interview_question_sets")
