"""Smart Pool: auto-match candidates with jobs using pgvector."""
import uuid
import logging

from sqlalchemy import text, select, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models import Job, Candidate, JobCandidate

logger = logging.getLogger(__name__)


async def match_candidate_to_all_jobs(candidate_id: str, db: AsyncSession):
    """Match a single candidate against all active jobs. Called after CV parsing."""
    candidate = await db.get(Candidate, uuid.UUID(candidate_id))
    if not candidate or candidate.embedding is None:
        return

    # Find all jobs with embeddings
    result = await db.execute(select(Job).where(Job.embedding.isnot(None)))
    jobs = result.scalars().all()

    cand_skills = {s.lower() for s in (candidate.structured_data.get("skills") or [])}

    for job in jobs:
        job_skills = {s.lower() for s in (job.required_skills or [])}
        # Compute similarity using pgvector
        sim_result = await db.execute(text("""
            SELECT 1 - (embedding <=> CAST(:job_embedding AS vector)) AS similarity
            FROM candidates WHERE id = CAST(:cand_id AS UUID)
        """), {
            "job_embedding": "[" + ",".join(str(float(x)) for x in job.embedding) + "]",
            "cand_id": str(candidate.id),
        })
        row = sim_result.mappings().first()
        similarity = float(row["similarity"]) if row else 0.0

        # Skill overlap
        overlap = job_skills & cand_skills
        skill_score = len(overlap) / len(job_skills) if job_skills else 0.0
        combined = similarity * 0.6 + skill_score * 0.4

        # Upsert into job_candidates
        existing = await db.execute(
            select(JobCandidate).where(
                JobCandidate.job_id == job.id,
                JobCandidate.candidate_id == candidate.id,
            )
        )
        jc = existing.scalar_one_or_none()
        if jc:
            jc.similarity_score = round(similarity, 4)
            jc.skill_score = round(skill_score, 4)
            jc.combined_score = round(combined, 4)
        else:
            db.add(JobCandidate(
                job_id=job.id,
                candidate_id=candidate.id,
                similarity_score=round(similarity, 4),
                skill_score=round(skill_score, 4),
                combined_score=round(combined, 4),
            ))

    await db.commit()
    logger.info(f"Matched candidate {candidate_id[:8]} to {len(jobs)} jobs")


async def match_job_to_all_candidates(job_id: str, db: AsyncSession):
    """Match a single job against all candidates with embeddings. Called after job create/update."""
    job = await db.get(Job, uuid.UUID(job_id))
    if not job or job.embedding is None:
        return

    job_skills = {s.lower() for s in (job.required_skills or [])}
    embedding_str = "[" + ",".join(str(float(x)) for x in job.embedding) + "]"

    # Find top candidates by similarity
    result = await db.execute(text("""
        SELECT id, structured_data,
               1 - (embedding <=> CAST(:job_embedding AS vector)) AS similarity
        FROM candidates
        WHERE embedding IS NOT NULL AND status != 'processing'
        ORDER BY embedding <=> CAST(:job_embedding AS vector) ASC
        LIMIT 50
    """), {"job_embedding": embedding_str})
    candidates = result.mappings().all()

    for c in candidates:
        cand_skills = {s.lower() for s in (c["structured_data"].get("skills") or [])}
        similarity = float(c["similarity"])
        overlap = job_skills & cand_skills
        skill_score = len(overlap) / len(job_skills) if job_skills else 0.0
        combined = similarity * 0.6 + skill_score * 0.4

        # Upsert
        existing = await db.execute(
            select(JobCandidate).where(
                JobCandidate.job_id == job.id,
                JobCandidate.candidate_id == c["id"],
            )
        )
        jc = existing.scalar_one_or_none()
        if jc:
            jc.similarity_score = round(similarity, 4)
            jc.skill_score = round(skill_score, 4)
            jc.combined_score = round(combined, 4)
        else:
            db.add(JobCandidate(
                job_id=job.id,
                candidate_id=c["id"],
                similarity_score=round(similarity, 4),
                skill_score=round(skill_score, 4),
                combined_score=round(combined, 4),
            ))

    await db.commit()
    logger.info(f"Matched job {job_id[:8]} to {len(candidates)} candidates")


def background_match_candidate(candidate_id: str):
    """Run matching in a background thread (called after AI parsing)."""
    import asyncio
    import threading

    def _run():
        try:
            async def _match():
                engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
                factory = async_sessionmaker(engine, expire_on_commit=False)
                async with factory() as db:
                    await match_candidate_to_all_jobs(candidate_id, db)
                await engine.dispose()

            loop = asyncio.new_event_loop()
            loop.run_until_complete(_match())
            loop.close()
        except Exception as e:
            logger.error(f"Background match failed for candidate {candidate_id[:8]}: {e}")

    threading.Thread(target=_run, daemon=True).start()


async def background_match_job(job_id: str):
    """Run matching for a job (used with FastAPI BackgroundTasks)."""
    engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        await match_job_to_all_candidates(job_id, db)
    await engine.dispose()
