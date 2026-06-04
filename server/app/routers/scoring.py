import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, Score, User
from app.schemas import ScoreRead
from app.services.matching import compute_match_score, get_embedding
from app.services.scoring import compute_rule_score

router = APIRouter(prefix="/scoring", tags=["scoring"])


@router.post("/jobs/{job_id}/match")
async def match_and_score_candidates(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Match all candidates for a job, compute hybrid scores (rule 70% + LLM 30%)."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    result = await db.execute(select(Candidate).where(Candidate.job_id == job_id))
    candidates = result.scalars().all()
    if not candidates:
        raise HTTPException(404, "No candidates found for this job")

    job_embedding = job.embedding if job.embedding is not None else get_embedding(job.title + " " + (job.description or ""))

    results = []
    for cand in candidates:
        cand_embedding = cand.embedding
        if cand_embedding is None:
            cand_text = " ".join(cand.structured_data.get("skills", []))
            cand_embedding = get_embedding(cand_text)

        # Matching (cosine + keyword)
        cand_skills = cand.structured_data.get("skills", [])
        match_result = compute_match_score(job_embedding, cand_embedding, job.required_skills, cand_skills)

        # Hybrid scoring (rule 70% + LLM 30%)
        score_result = compute_rule_score(
            job_skills=job.required_skills,
            candidate_data=cand.structured_data,
            required_years=cand.structured_data.get("required_years"),
            required_education=cand.structured_data.get("required_education"),
            job_title=job.title,
        )

        final_score = score_result["final_score"]
        classification = score_result["classification"]
        cand.match_score = match_result["combined_score"]

        # Upsert Score
        existing = await db.execute(select(Score).where(Score.candidate_id == cand.id))
        score_obj = existing.scalar_one_or_none()
        details = {
            "matching": match_result,
            "rule_scoring": score_result["details"],
            "llm_score": score_result["llm_score"],
            "llm_summary": score_result["llm_summary"],
        }

        if score_obj:
            score_obj.rule_score = score_result["rule_score"]
            score_obj.llm_score = score_result["llm_score"]
            score_obj.final_score = final_score
            score_obj.classification = classification
            score_obj.details = details
        else:
            score_obj = Score(
                candidate_id=cand.id,
                rule_score=score_result["rule_score"],
                llm_score=score_result["llm_score"],
                final_score=final_score,
                classification=classification,
                details=details,
            )
            db.add(score_obj)

        results.append({
            "candidate_id": str(cand.id),
            "match_score": match_result["combined_score"],
            "rule_score": score_result["rule_score"],
            "llm_score": score_result["llm_score"],
            "final_score": final_score,
            "classification": classification,
        })

    await db.commit()
    return {"job_id": str(job_id), "candidates_scored": len(results), "results": results}


@router.get("/candidates/{candidate_id}/score", response_model=ScoreRead)
async def get_candidate_score(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Score).where(Score.candidate_id == candidate_id))
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(404, "Score not found. Run match first.")
    return score
