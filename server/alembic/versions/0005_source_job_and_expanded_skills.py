from alembic import op

revision = '0005_source_job_expanded'
down_revision = '0004_question_cache_v2'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE cv_batches ADD COLUMN IF NOT EXISTS target_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL")


def downgrade():
    op.execute("ALTER TABLE cv_batches DROP COLUMN IF EXISTS target_job_id")
    op.execute("ALTER TABLE candidates DROP COLUMN IF EXISTS source_job_id")
