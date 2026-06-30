import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, Score, User
from app.schemas import ScoreRead
from app.services.matching import compute_match_score, get_embedding
from app.services.scoring import compute_rule_score

router = APIRouter(prefix="/scoring", tags=["scoring"])

_limiter = Limiter(key_func=get_remote_address)


@router.post("/jobs/{job_id}/match")
@_limiter.limit("5/minute")
async def match_and_score_candidates(
    request: Request,
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
            cand_embedding = get_embedding(cand_text, candidate_id=str(cand.id))

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
            candidate_id=str(cand.id), job_description=job.description or "", job_skills_expanded=job.required_skills_expanded or [],
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


@router.get("/candidates/{candidate_id}/explanation")
async def get_score_explanation(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return detailed AI score explanation with breakdown, strengths, concerns, and suggestion."""
    import json as json_lib

    result = await db.execute(select(Score).where(Score.candidate_id == candidate_id))
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(404, "Score not found")

    candidate = await db.get(Candidate, candidate_id)
    details = score.details or {}
    rule_scoring = details.get("rule_scoring", {})
    matching = details.get("matching", {})

    # Parse LLM summary (may be JSON or plain string)
    llm_summary_raw = details.get("llm_summary", "")
    llm_parsed = {"summary": llm_summary_raw, "strengths": [], "concerns": [], "suggestion": ""}
    try:
        parsed = json_lib.loads(llm_summary_raw)
        if isinstance(parsed, dict):
            llm_parsed = parsed
    except (json_lib.JSONDecodeError, TypeError):
        pass

    # Build explanation
    skills_info = rule_scoring.get("skills", {})
    exp_info = rule_scoring.get("experience", {})
    edu_info = rule_scoring.get("education", {})
    lang_info = rule_scoring.get("language", {})
    weights = rule_scoring.get("weights", {"skills": 0.3, "cosine": 0.25, "experience": 0.2, "education": 0.15, "language": 0.1})

    return {
        "candidate_id": str(candidate_id),
        "candidate_name": candidate.structured_data.get("name", "Unknown") if candidate else "Unknown",
        "final_score": score.final_score,
        "rule_score": score.rule_score,
        "llm_score": score.llm_score,
        "classification": score.classification,
        "breakdown": {
            "skills": {
                "score": skills_info.get("score", 0),
                "weight": weights.get("skills", 0.3),
                "matched": skills_info.get("matched", []),
                "missing": skills_info.get("missing", []),
            },
            "cosine_similarity": {
                "score": round((matching.get("cosine_score", 0) or 0) * 100, 1),
                "weight": weights.get("cosine", 0.25),
            },
            "experience": {
                "score": exp_info.get("score", 0),
                "weight": weights.get("experience", 0.2),
                "note": exp_info.get("note", ""),
            },
            "education": {
                "score": edu_info.get("score", 0),
                "weight": weights.get("education", 0.15),
                "note": edu_info.get("note", ""),
            },
            "language": {
                "score": lang_info.get("score", 0),
                "weight": weights.get("language", 0.1),
            },
        },
        "ai_assessment": {
            "score": score.llm_score,
            "summary": llm_parsed.get("summary", llm_summary_raw),
            "strengths": llm_parsed.get("strengths", []),
            "concerns": llm_parsed.get("concerns", []),
            "suggestion": llm_parsed.get("suggestion", ""),
        },
        "formula": "Final = Rule Score × 70% + AI Score × 30%",
    }
