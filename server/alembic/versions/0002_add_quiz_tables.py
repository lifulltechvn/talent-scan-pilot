"""add quiz tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quizzes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("token", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("reason", sa.String(50), nullable=False),  # insufficient_data / suspected_ai_cv
        sa.Column("status", sa.String(20), server_default="'pending'"),  # pending / submitted / evaluated / expired
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("credibility_score", sa.Float(), nullable=True),
        sa.Column("ai_evaluation", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "quiz_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quiz_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quizzes.id"), nullable=False),
        sa.Column("question_type", sa.String(30), nullable=False),  # technical_depth / situation / project_detail
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("purpose", sa.Text()),
        sa.Column("eval_criteria", sa.Text()),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
    )

    op.create_table(
        "quiz_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quiz_questions.id"), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("verdict", sa.String(20)),  # credible / vague / suspicious
        sa.Column("verdict_reason", sa.Text()),
        sa.Column("responded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("quiz_responses")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
