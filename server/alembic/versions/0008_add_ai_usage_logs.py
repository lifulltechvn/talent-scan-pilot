"""Add ai_usage_logs table."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_usage_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_id", sa.String(100), nullable=False),
        sa.Column("feature", sa.String(50), nullable=False),
        sa.Column("input_tokens", sa.Integer, server_default="0", nullable=False),
        sa.Column("output_tokens", sa.Integer, server_default="0", nullable=False),
        sa.Column("cost_usd", sa.Float, server_default="0", nullable=False),
        sa.Column("source", sa.String(20), server_default="'server'", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"])
    op.create_index("ix_ai_usage_logs_feature", "ai_usage_logs", ["feature"])


def downgrade() -> None:
    op.drop_table("ai_usage_logs")
