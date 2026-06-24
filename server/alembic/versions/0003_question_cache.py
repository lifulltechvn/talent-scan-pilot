"""question_cache table with round support"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DROP TABLE IF EXISTS question_cache")
    op.execute("""
        CREATE TABLE question_cache (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            candidate_id UUID NOT NULL,
            category VARCHAR(50) NOT NULL,
            skill VARCHAR(100),
            question_en TEXT NOT NULL,
            question_vi TEXT,
            answer_en TEXT,
            answer_vi TEXT,
            red_flag_en TEXT,
            red_flag_vi TEXT,
            level VARCHAR(20) NOT NULL,
            round INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_qcache_candidate ON question_cache(candidate_id)")
    op.execute("CREATE INDEX idx_qcache_candidate_round ON question_cache(candidate_id, round)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS question_cache;")
