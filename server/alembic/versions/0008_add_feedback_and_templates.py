"""Add interview_feedback and email_templates tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interview_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("interviewer", sa.String(100), nullable=False),
        sa.Column("round", sa.Integer, default=1),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("strengths", sa.Text),
        sa.Column("weaknesses", sa.Text),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "email_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("template_type", sa.String(30), unique=True, nullable=False),
        sa.Column("greeting", sa.Text, server_default=""),
        sa.Column("body", sa.Text, server_default=""),
        sa.Column("closing", sa.Text, server_default=""),
        sa.Column("highlights", JSONB, nullable=True),
        sa.Column("tips", JSONB, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("email_templates")
    op.drop_table("interview_feedback")
