"""Add reminder_sent to schedule_bookings."""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("schedule_bookings", sa.Column("reminder_sent", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("schedule_bookings", "reminder_sent")
