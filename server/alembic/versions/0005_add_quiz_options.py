"""Add options column to quiz_questions for radio/checkbox support."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quiz_questions", sa.Column("options", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("quiz_questions", "options")
