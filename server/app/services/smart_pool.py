"""Smart Pool: auto-match candidates with jobs using pgvector."""
import uuid
import logging

from sqlalchemy import text, select, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models import Job, Candidate, JobCandidate, Score

logger = logging.getLogger(__name__)


async def match_candidate_to_all_jobs(candidate_id: str, db: AsyncSession):
    """Match a single candidate against all active jobs. Called after CV parsing."""
    candidate = await db.get(Candidate, uuid.UUID(candidate_id))
    if not candidate or candidate.embedding is None:
        return

    from app.skill_normalizer import normalize_skills

    # Find all jobs with embeddings
    result = await db.execute(select(Job).where(Job.embedding.isnot(None)))
    jobs = result.scalars().all()

    cand_skills = {s.lower() for s in normalize_skills(candidate.structured_data.get("skills") or [])}

    for job in jobs:
        job_skills = {s.lower() for s in normalize_skills(job.required_skills or [])}
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
    from app.skill_normalizer import normalize_skills

    job = await db.get(Job, uuid.UUID(job_id))
    if not job or job.embedding is None:
        return

    job_skills = {s.lower() for s in normalize_skills(job.required_skills or [])}
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
        cand_skills = {s.lower() for s in normalize_skills(c["structured_data"].get("skills") or [])}
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
    """Run matching in a background thread, then auto-score top matches."""
    import asyncio
    import threading

    def _run():
        try:
            async def _match_and_score():
                engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
                factory = async_sessionmaker(engine, expire_on_commit=False)
                async with factory() as db:
                    await match_candidate_to_all_jobs(candidate_id, db)
                    await _auto_score_candidate(candidate_id, db)
                await engine.dispose()

            loop = asyncio.new_event_loop()
            loop.run_until_complete(_match_and_score())
            loop.close()
        except Exception as e:
            logger.error(f"Background match failed for candidate {candidate_id[:8]}: {e}")

    threading.Thread(target=_run, daemon=True).start()


AUTO_SCORE_THRESHOLD = 0.3  # Only auto-score if combined_score >= this


async def _auto_score_candidate(candidate_id: str, db: AsyncSession):
    """Auto-score candidate for top matching jobs (combined_score >= threshold)."""
    from app.services.scoring import compute_rule_score
    from app.services.matching import compute_match_score
    from app.models import Score

    candidate = await db.get(Candidate, uuid.UUID(candidate_id))
    if not candidate or not candidate.structured_data:
        return

    # Find top matches above threshold
    matches = await db.execute(
        select(JobCandidate).where(
            JobCandidate.candidate_id == candidate.id,
            JobCandidate.combined_score >= AUTO_SCORE_THRESHOLD,
            JobCandidate.status == "suggested",
        ).order_by(JobCandidate.combined_score.desc()).limit(5)
    )
    top_matches = matches.scalars().all()

    if not top_matches:
        return

    # Score for the best matching job
    best = top_matches[0]
    job = await db.get(Job, best.job_id)
    if not job:
        return

    # Update status to assigned
    best.status = "assigned"

    # Compute full score
    try:
        score_result = compute_rule_score(
            job_skills=job.required_skills or [],
            candidate_data=candidate.structured_data,
            required_years=job.required_years,
            required_education=job.required_education,
            job_title=job.title,
            use_llm=True,
        )

        # Cosine similarity
        match_data = {
            "cosine_score": best.similarity_score,
            "keyword_score": best.skill_score,
            "combined_score": best.combined_score,
        }

        final_score = score_result["final_score"]
        classification = score_result["classification"]

        # Update job_candidate
        best.final_score = final_score
        best.classification = classification
        best.details = {"matching": match_data, "rule_scoring": score_result["details"], "llm_summary": score_result.get("llm_summary", ""), "auto_scored": True}

        # Upsert Score record
        existing_score = await db.execute(select(Score).where(Score.candidate_id == candidate.id))
        score = existing_score.scalar_one_or_none()
        if score:
            score.rule_score = score_result["rule_score"]
            score.llm_score = score_result.get("llm_score")
            score.final_score = final_score
            score.classification = classification
            score.details = best.details
        else:
            db.add(Score(
                candidate_id=candidate.id,
                rule_score=score_result["rule_score"],
                llm_score=score_result.get("llm_score"),
                final_score=final_score,
                classification=classification,
                details=best.details,
            ))

        # Auto-promote gold candidates
        if classification == "gold" and candidate.status == "new":
            candidate.status = "reviewed"

        # Link candidate to best job if not already linked
        if not candidate.job_id:
            candidate.job_id = job.id

        await db.commit()
        logger.info(f"Auto-scored candidate {candidate_id[:8]} → {classification} ({final_score:.0f}) for job '{job.title}'")

    except Exception as e:
        logger.error(f"Auto-score failed for candidate {candidate_id[:8]}: {e}")
        await db.rollback()


async def background_match_job(job_id: str):
    """Run matching for a job (used with FastAPI BackgroundTasks)."""
    engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        await match_job_to_all_candidates(job_id, db)
    await engine.dispose()
