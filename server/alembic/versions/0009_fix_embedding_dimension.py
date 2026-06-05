"""fix embedding dimension 1536 -> 1024"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE jobs ALTER COLUMN embedding TYPE vector(1024)")
    op.execute("ALTER TABLE candidates ALTER COLUMN embedding TYPE vector(1024)")


def downgrade():
    op.execute("ALTER TABLE jobs ALTER COLUMN embedding TYPE vector(1536)")
    op.execute("ALTER TABLE candidates ALTER COLUMN embedding TYPE vector(1536)")
