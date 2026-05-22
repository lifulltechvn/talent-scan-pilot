"""Make outreach_logs.candidate_id nullable, add to_email column."""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("outreach_logs", "candidate_id", nullable=True)
    op.add_column("outreach_logs", sa.Column("to_email", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("outreach_logs", "to_email")
    op.alter_column("outreach_logs", "candidate_id", nullable=False)
