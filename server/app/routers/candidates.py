import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, User
from app.schemas import CandidateCreate, CandidateRead
from app.services.cv_upload import CV_UPLOAD_DIR

router = APIRouter(prefix="/candidates", tags=["candidates"])


class BlacklistRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class NoteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class CandidateDataUpdate(BaseModel):
    data: dict = Field(default_factory=dict)


@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    candidate = Candidate(**data.model_dump())
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    # Auto-score if job_id provided
    if candidate.job_id:
        try:
            from app.models import Job, Score
            from app.services.matching import compute_match_score, get_embedding
            from app.services.scoring import compute_rule_score

            result = await db.execute(select(Job).where(Job.id == candidate.job_id))
            job = result.scalar_one_or_none()
            if job:
                job_embedding = job.embedding
                cand_embedding = candidate.embedding

                cand_skills = candidate.structured_data.get("skills", [])
                match_result = compute_match_score(job_embedding, cand_embedding, job.required_skills, cand_skills)
                score_result = compute_rule_score(
                    job_skills=job.required_skills,
                    candidate_data=candidate.structured_data,
                    job_title=job.title, job_description=job.description or "",
                )

                candidate.match_score = match_result["combined_score"]
                score_obj = Score(
                    candidate_id=candidate.id,
                    rule_score=score_result["rule_score"],
                    llm_score=score_result["llm_score"],
                    final_score=score_result["final_score"],
                    classification=score_result["classification"],
                    details={"matching": match_result, "rule_scoring": score_result["details"], "llm_score": score_result["llm_score"], "llm_summary": score_result.get("llm_summary", "")},
                )
                db.add(score_obj)

                await db.commit()
                await db.refresh(candidate)
        except Exception:
            pass

    return candidate


@router.get("")
async def list_candidates(
    job_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Search by name or skills"),
    classification: Optional[str] = Query(None, description="gold/silver/talent_pool"),
    min_score: Optional[float] = Query(None),
    max_score: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Candidate).where(Candidate.status != 'blacklisted').order_by(text("CASE WHEN status = 'processing' THEN 1 ELSE 0 END"), Candidate.created_at.desc())
    if job_id:
        q = q.where(Candidate.job_id == job_id)
    if status_filter:
        q = q.where(Candidate.status == status_filter)
    if search:
        search_like = f"%{search.lower()}%"
        q = q.where(
            Candidate.structured_data["name"].astext.ilike(search_like)
            | Candidate.structured_data["skills"].astext.ilike(search_like)
        )
    joined_score = False
    if classification:
        from app.models import Score
        q = q.join(Score, Score.candidate_id == Candidate.id).where(Score.classification == classification)
        joined_score = True
    if min_score is not None:
        from app.models import Score
        if not joined_score:
            q = q.join(Score, Score.candidate_id == Candidate.id)
            joined_score = True
        q = q.where(Score.final_score >= min_score)
    if max_score is not None:
        from app.models import Score
        if not joined_score:
            q = q.join(Score, Score.candidate_id == Candidate.id)
            joined_score = True
        q = q.where(Score.final_score <= max_score)

    # Pagination
    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)

    result = await db.execute(q)
    candidates = result.scalars().all()

    out = []
    # Batch fetch job titles
    job_ids = {c.job_id for c in candidates if c.job_id}
    job_titles = {}
    if job_ids:
        from app.models import Job
        jr = await db.execute(select(Job.id, Job.title).where(Job.id.in_(job_ids)))
        job_titles = {row[0]: row[1] for row in jr.all()}

    # Batch fetch latest interview end_time for pending candidates
    pending_ids = [c.id for c in candidates if c.status == 'pending']
    interview_times = {}
    if pending_ids:
        from sqlalchemy import text as sql_text
        iv_rows = await db.execute(sql_text("""
            SELECT DISTINCT ON (candidate_id) candidate_id, end_time
            FROM interviews WHERE candidate_id = ANY(:ids)
            ORDER BY candidate_id, start_time DESC
        """), {"ids": pending_ids})
        for r in iv_rows.mappings().all():
            interview_times[r["candidate_id"]] = r["end_time"].isoformat() if r["end_time"] else None

    for c in candidates:
        out.append({
            "id": c.id, "job_id": c.job_id,
            "job_title": job_titles.get(c.job_id) if c.job_id else None,
            "structured_data": c.structured_data,
            "status": c.status, "match_score": c.match_score,
            "source_app_version": c.source_app_version, "scanned_at": c.scanned_at,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "interview_end_time": interview_times.get(c.id) if c.status == 'pending' else None,
        })
    return out


@router.post("/{candidate_id}/blacklist")
async def blacklist_candidate(
    candidate_id: uuid.UUID,
    body: BlacklistRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add candidate to blacklist."""
    from sqlalchemy import text as sqt
    reason = body.reason
    if not reason:
        raise HTTPException(400, "Reason is required")
    await db.execute(sqt("""
        UPDATE candidates SET status = 'blacklisted', blacklist_reason = :reason,
            blacklisted_at = NOW(), blacklisted_by = :uid WHERE id = :cid
    """), {"reason": reason, "uid": str(user.id), "cid": str(candidate_id)})
    await db.commit()
    return {"status": "blacklisted"}


@router.post("/{candidate_id}/unblacklist")
async def unblacklist_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove candidate from blacklist."""
    from sqlalchemy import text as sqt
    await db.execute(sqt("""
        UPDATE candidates SET status = 'reviewed', blacklist_reason = NULL,
            blacklisted_at = NULL, blacklisted_by = NULL WHERE id = :cid
    """), {"cid": str(candidate_id)})
    await db.commit()
    return {"status": "unblacklisted"}


@router.get("/blacklist")
async def get_blacklisted(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all blacklisted candidates."""
    from sqlalchemy import text as sqt
    rows = await db.execute(sqt("""
        SELECT c.id, c.structured_data->>'name' as name, c.structured_data->>'email' as email,
            c.blacklist_reason, c.blacklisted_at, u.full_name as blacklisted_by_name
        FROM candidates c LEFT JOIN users u ON u.id = c.blacklisted_by
        WHERE c.status = 'blacklisted' ORDER BY c.blacklisted_at DESC
    """))
    return [dict(r) for r in rows.mappings().all()]


@router.get("/export")
async def export_candidates(
    format: str = Query("csv", regex="^(csv|excel)$"),
    job_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export candidates to CSV or Excel."""
    import csv
    import io
    from fastapi.responses import StreamingResponse
    from sqlalchemy import text as sql_text

    query = """
        SELECT c.structured_data->>'name' as name,
               c.structured_data->>'skills' as skills,
               c.structured_data->>'experience_years' as experience_years,
               c.structured_data->>'education_level' as education,
               c.structured_data->>'expectedSalary' as salary,
               c.status,
               jc.final_score, jc.classification,
               j.title as job_title,
               c.created_at
        FROM candidates c
        LEFT JOIN job_candidates jc ON jc.candidate_id = c.id
        LEFT JOIN jobs j ON j.id = jc.job_id
        WHERE c.status != 'processing'
    """
    params = {}
    if job_id:
        query += " AND jc.job_id = :jid"
        params["jid"] = str(job_id)
    query += " ORDER BY jc.final_score DESC NULLS LAST"

    result = await db.execute(sql_text(query), params)
    rows = result.mappings().all()

    headers = ["Name", "Skills", "Experience (yrs)", "Education", "Expected Salary", "Status", "Score", "Classification", "Job", "Applied Date"]

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for r in rows:
            writer.writerow([
                r["name"], r["skills"], r["experience_years"], r["education"],
                r["salary"], r["status"], r["final_score"] or "", r["classification"] or "",
                r["job_title"] or "", str(r["created_at"])[:10] if r["created_at"] else "",
            ])
        output.seek(0)
        return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=candidates.csv"})
    else:
        from openpyxl import Workbook
        from openpyxl.styles import Font
        wb = Workbook()
        ws = wb.active
        ws.title = "Candidates"
        ws.append(headers)
        for r in rows:
            ws.append([
                r["name"], r["skills"], r["experience_years"], r["education"],
                r["salary"], r["status"], r["final_score"] or "", r["classification"] or "",
                r["job_title"] or "", str(r["created_at"])[:10] if r["created_at"] else "",
            ])
        for cell in ws[1]:
            cell.font = Font(bold=True)
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return StreamingResponse(iter([output.getvalue()]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=candidates.xlsx"})


@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Count matched jobs from Smart Pool
    from sqlalchemy import text as sa_text
    mc = await db.execute(sa_text("SELECT COUNT(*) FROM job_candidates WHERE candidate_id = :cid"), {"cid": str(candidate_id)})
    matched_jobs_count = mc.scalar() or 0

    return {
        "id": candidate.id, "job_id": candidate.job_id,
        "structured_data": candidate.structured_data,
        "status": candidate.status, "match_score": candidate.match_score,
        "cv_file_path": candidate.cv_file_path,
        "source_app_version": candidate.source_app_version,
        "scanned_at": candidate.scanned_at, "created_at": candidate.created_at,
        "matched_jobs_count": matched_jobs_count,
    }


@router.get("/{candidate_id}/matched-jobs")
async def get_candidate_matched_jobs(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all jobs this candidate matches, ordered by combined_score."""
    from sqlalchemy import text

    rows = await db.execute(text("""
        SELECT jc.job_id, jc.similarity_score, jc.skill_score, jc.combined_score,
               jc.status, jc.final_score, jc.classification, jc.matched_at, jc.details,
               j.title, j.required_skills, j.location
        FROM job_candidates jc
        JOIN jobs j ON j.id = jc.job_id
        WHERE jc.candidate_id = :cid
        ORDER BY jc.combined_score DESC
    """), {"cid": str(candidate_id)})

    # Also fetch candidate skills for matched_skills computation
    cand = await db.execute(text("SELECT structured_data FROM candidates WHERE id = :cid"), {"cid": str(candidate_id)})
    cand_row = cand.mappings().first()
    cand_skills = [s.lower() for s in (cand_row["structured_data"].get("skills", []) if cand_row else [])]

    results = []
    for r in rows.mappings().all():
        req_skills = r["required_skills"] or []
        matched = [s for s in req_skills if s.lower() in cand_skills]
        results.append({
            "job_id": str(r["job_id"]),
            "title": r["title"],
            "location": r["location"],
            "required_skills": req_skills,
            "matched_skills": matched,
            "missing_skills": [s for s in req_skills if s.lower() not in cand_skills],
            "similarity_score": round(float(r["similarity_score"]), 4),
            "skill_score": round(float(r["skill_score"]), 4),
            "combined_score": round(float(r["combined_score"]), 4),
            "status": r["status"],
            "final_score": r["final_score"],
            "classification": r["classification"],
            "details": r["details"],
            "matched_at": str(r["matched_at"]),
        })
    return results


@router.get("/{candidate_id}/avatar")
async def get_candidate_avatar(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get candidate's avatar extracted from CV."""
    import os
    from fastapi.responses import FileResponse
    avatar_dir = "/app/uploads/avatars"
    avatar_path = os.path.realpath(os.path.join(avatar_dir, f"{candidate_id}.jpg"))
    if not avatar_path.startswith(os.path.realpath(avatar_dir)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.exists(avatar_path):
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(avatar_path, media_type="image/jpeg")


@router.get("/{candidate_id}/cv")
async def download_candidate_cv(
    candidate_id: uuid.UUID,
    inline: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download or view the original CV file for a candidate."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if not candidate.cv_file_path:
        raise HTTPException(status_code=404, detail="CV file not available")

    import os
    file_path = os.path.join(CV_UPLOAD_DIR, candidate.cv_file_path)
    # Path traversal protection
    real_path = os.path.realpath(file_path)
    if not real_path.startswith(os.path.realpath(CV_UPLOAD_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="CV file not found on disk")

    filename = candidate.cv_file_path
    media_type = "application/pdf" if filename.endswith(".pdf") else "application/octet-stream"

    if inline:
        from starlette.responses import Response
        with open(file_path, "rb") as f:
            content = f.read()
        return Response(content, media_type=media_type, headers={"Content-Disposition": f"inline; filename=\"{filename}\""})

    return FileResponse(file_path, filename=filename, media_type=media_type)


@router.patch("/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: uuid.UUID,
    new_status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    valid = {"new", "reviewed", "assigned", "pending", "approved", "rejected"}
    if new_status not in valid:
        raise HTTPException(400, f"Status must be one of: {valid}")
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    candidate.status = new_status
    await db.commit()
    return {"id": candidate.id, "status": new_status}


@router.patch("/{candidate_id}/data")
async def update_candidate_data(
    candidate_id: uuid.UUID,
    body: CandidateDataUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update structured_data fields (HR edit parsed data)."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    # Merge updates into existing data
    current = candidate.structured_data or {}
    for key, value in body.data.items():
        if key.startswith("_"):
            continue  # Don't allow editing internal fields
        current[key] = value
    candidate.structured_data = current
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(candidate, "structured_data")
    await db.commit()
    return {"status": "updated", "id": str(candidate_id)}

@router.post("/{candidate_id}/notes")
async def add_note(
    candidate_id: uuid.UUID,
    body: NoteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a note/comment to a candidate."""
    from app.models import AuditLog
    note_text = body.text.strip()
    if not note_text:
        raise HTTPException(400, "Note text is required")

    log = AuditLog(
        user_id=user.id,
        action="note_added",
        entity_type="candidate",
        entity_id=str(candidate_id),
        details={"text": note_text, "author": user.full_name},
    )
    db.add(log)
    await db.commit()
    return {"id": str(log.id), "text": note_text, "author": user.full_name, "created_at": log.created_at}


@router.get("/{candidate_id}/notes")
async def get_notes(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all notes for a candidate."""
    from app.models import AuditLog
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "candidate",
            AuditLog.entity_id == str(candidate_id),
            AuditLog.action == "note_added",
        ).order_by(AuditLog.created_at.desc())
    )
    notes = result.scalars().all()
    return [
        {"id": str(n.id), "text": n.details.get("text", ""), "author": n.details.get("author", ""), "created_at": n.created_at}
        for n in notes
    ]





@router.delete("/{candidate_id}", status_code=204)
async def delete_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Delete a candidate with status 'new' from the system."""
    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    if candidate.status != "new":
        raise HTTPException(400, "Only candidates with status 'new' can be deleted")
    # Clean up related data
    from sqlalchemy import text
    await db.execute(text("DELETE FROM scores WHERE candidate_id = :id"), {"id": str(candidate_id)})
    await db.execute(text("DELETE FROM job_candidates WHERE candidate_id = :id"), {"id": str(candidate_id)})
    await db.execute(text("UPDATE cv_batch_items SET duplicate_of = NULL WHERE duplicate_of = :id"), {"id": str(candidate_id)})
    await db.execute(text("DELETE FROM cv_batch_items WHERE candidate_id = :id"), {"id": str(candidate_id)})
    await db.execute(text("DELETE FROM timeline_events WHERE candidate_id = :id"), {"id": str(candidate_id)})
    await db.delete(candidate)
    await db.commit()
