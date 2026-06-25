"""Restructure question_cache for 3 categories per job"""
from alembic import op

revision = '0004_question_cache_v2'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DROP TABLE IF EXISTS question_cache")
    op.execute("""
        CREATE TABLE question_cache (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL,
            category VARCHAR(50) NOT NULL,
            cache_key VARCHAR(200) NOT NULL,
            questions_en JSONB NOT NULL DEFAULT '[]',
            questions_vi JSONB,
            jd_hash VARCHAR(64),
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(job_id, cache_key)
        )
    """)
    op.execute("CREATE INDEX idx_qcache_job ON question_cache(job_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS question_cache")

    # Timeline events
    op.execute("""
        CREATE TABLE IF NOT EXISTS timeline_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            candidate_id UUID NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_timeline_candidate ON timeline_events(candidate_id)")
