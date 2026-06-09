"""Add smart pool and batch upload tables

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Jobs: add required_years and required_education
    op.add_column("jobs", sa.Column("required_years", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("required_education", sa.String(50), nullable=True))

    # Candidates: add cv_hash
    op.add_column("candidates", sa.Column("cv_hash", sa.String(32), nullable=True))

    # Job candidates junction table (smart pool)
    op.create_table(
        "job_candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("similarity_score", sa.Float(), server_default="0.0"),
        sa.Column("skill_score", sa.Float(), server_default="0.0"),
        sa.Column("combined_score", sa.Float(), server_default="0.0"),
        sa.Column("status", sa.String(20), server_default="'suggested'"),
        sa.Column("final_score", sa.Float(), nullable=True),
        sa.Column("classification", sa.String(20), nullable=True),
        sa.Column("details", JSONB(), nullable=True),
        sa.Column("matched_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("job_id", "candidate_id"),
    )
    op.create_index("idx_job_candidates_job_id", "job_candidates", ["job_id"])
    op.create_index("idx_job_candidates_candidate_id", "job_candidates", ["candidate_id"])
    op.create_index("idx_job_candidates_combined_score", "job_candidates", ["combined_score"], postgresql_ops={"combined_score": "DESC"})

    # CV batch upload tables
    op.create_table(
        "cv_batches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("total_files", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="'uploading'"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "cv_batch_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("cv_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_hash", sa.String(32), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="'pending'"),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("duplicate_of", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_batch_items_batch_id", "cv_batch_items", ["batch_id"])


def downgrade() -> None:
    op.drop_table("cv_batch_items")
    op.drop_table("cv_batches")
    op.drop_table("job_candidates")
    op.drop_column("candidates", "cv_hash")
    op.drop_column("jobs", "required_education")
    op.drop_column("jobs", "required_years")
