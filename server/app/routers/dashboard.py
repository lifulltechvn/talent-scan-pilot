"""Dashboard API — overview stats + action items + recent activity."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
async def get_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # Stats
    total_candidates = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.status != 'processing'))).scalar() or 0
    new_this_week = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.created_at >= week_ago, Candidate.status != 'processing'))).scalar() or 0
    active_jobs = (await db.execute(select(func.count()).select_from(Job))).scalar() or 0
    gold_count = (await db.execute(text("SELECT count(*) FROM job_candidates WHERE classification = 'gold'"))).scalar() or 0
    interviews_today = (await db.execute(text("SELECT count(*) FROM interviews WHERE date(start_time AT TIME ZONE 'UTC') = date(now() AT TIME ZONE 'UTC')"))).scalar() or 0
    need_feedback = (await db.execute(text("SELECT count(*) FROM interviews WHERE status = 'scheduled' AND end_time < now()"))).scalar() or 0
    need_review = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.status == 'new'))).scalar() or 0
    pending_duplicates = (await db.execute(text("SELECT count(*) FROM cv_batch_items WHERE status = 'duplicate'"))).scalar() or 0

    # Today's interviews
    today_interviews = await db.execute(text("""
        SELECT i.id, i.start_time, i.end_time, i.title, i.status, i.feedback_score,
               c.structured_data->>'name' as candidate_name, j.title as job_title
        FROM interviews i
        LEFT JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN jobs j ON j.id = i.job_id
        WHERE date(i.start_time AT TIME ZONE 'UTC') = date(now() AT TIME ZONE 'UTC')
        ORDER BY i.start_time
    """))

    # Recent candidates (distinct by candidate)
    recent_candidates = await db.execute(text("""
        SELECT DISTINCT ON (c.id) c.id, c.structured_data->>'name' as name, c.status, c.created_at,
               jc.final_score, jc.classification, j.title as job_title
        FROM candidates c
        LEFT JOIN job_candidates jc ON jc.candidate_id = c.id
        LEFT JOIN jobs j ON j.id = jc.job_id
        WHERE c.status != 'processing'
        ORDER BY c.id, jc.combined_score DESC NULLS LAST
    """))
    recent_list = [
        {"id": str(r["id"]), "name": r["name"], "status": r["status"], "created_at": r["created_at"].isoformat(),
         "score": r["final_score"], "classification": r["classification"], "job_title": r["job_title"]}
        for r in recent_candidates.mappings().all()
    ]
    recent_list.sort(key=lambda x: x["created_at"], reverse=True)
    recent_list = recent_list[:5]

    # Jobs with candidate counts
    jobs_overview = await db.execute(text("""
        SELECT j.id, j.title, j.deadline,
               count(jc.id) as candidate_count,
               count(jc.id) FILTER (WHERE jc.classification = 'gold') as gold
        FROM jobs j
        LEFT JOIN job_candidates jc ON jc.job_id = j.id
        GROUP BY j.id, j.title, j.deadline
        ORDER BY j.created_at DESC
        LIMIT 5
    """))

    # Activity feed
    activity = await db.execute(text("""
        (SELECT 'candidate_added' as type, structured_data->>'name' as detail, created_at FROM candidates WHERE status != 'processing' ORDER BY created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'interview_created' as type, title as detail, created_at FROM interviews ORDER BY created_at DESC LIMIT 3)
        UNION ALL
        (SELECT 'job_created' as type, title as detail, created_at FROM jobs ORDER BY created_at DESC LIMIT 3)
        ORDER BY created_at DESC LIMIT 8
    """))

    return {
        "stats": {
            "total_candidates": total_candidates,
            "new_this_week": new_this_week,
            "active_jobs": active_jobs,
            "gold_count": gold_count,
            "interviews_today": interviews_today,
            "need_feedback": need_feedback,
            "need_review": need_review,
            "pending_duplicates": pending_duplicates,
        },
        "today_interviews": [
            {"id": str(r["id"]), "start_time": r["start_time"].isoformat(), "end_time": r["end_time"].isoformat(),
             "candidate_name": r["candidate_name"], "job_title": r["job_title"], "status": r["status"], "feedback_score": r["feedback_score"]}
            for r in today_interviews.mappings().all()
        ],
        "recent_candidates": recent_list,
        "jobs_overview": [
            {"id": str(r["id"]), "title": r["title"], "deadline": r["deadline"].isoformat() if r["deadline"] else None,
             "candidate_count": r["candidate_count"], "gold": r["gold"]}
            for r in jobs_overview.mappings().all()
        ],
        "activity": [
            {"type": r["type"], "detail": r["detail"], "created_at": r["created_at"].isoformat()}
            for r in activity.mappings().all()
        ],
    }


@router.get("/hiring-funnel")
async def get_hiring_funnel(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hiring funnel stats: conversion rates between stages."""
    total = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.status != 'processing'))).scalar() or 0
    reviewed = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.status.in_(['reviewed', 'approved', 'rejected'])))).scalar() or 0
    approved = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.status == 'approved'))).scalar() or 0
    rejected = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.status == 'rejected'))).scalar() or 0
    interviewed = (await db.execute(text("SELECT count(DISTINCT candidate_id) FROM interviews"))).scalar() or 0
    hired = (await db.execute(text("SELECT count(DISTINCT candidate_id) FROM interviews WHERE feedback_decision = 'pass'"))).scalar() or 0

    return {
        "funnel": [
            {"stage": "Total CVs", "count": total},
            {"stage": "Reviewed", "count": reviewed},
            {"stage": "Approved", "count": approved},
            {"stage": "Interviewed", "count": interviewed},
            {"stage": "Hired", "count": hired},
        ],
        "rejection_rate": round(rejected / total * 100, 1) if total else 0,
        "approval_rate": round(approved / total * 100, 1) if total else 0,
        "interview_rate": round(interviewed / approved * 100, 1) if approved else 0,
    }


@router.get("/weekly-stats")
async def get_weekly_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Weekly recruitment stats for the last 4 weeks."""
    now = datetime.now(timezone.utc)
    weeks = []
    for i in range(4):
        end = now - timedelta(weeks=i)
        start = end - timedelta(weeks=1)
        uploads = (await db.execute(select(func.count()).select_from(Candidate).where(Candidate.created_at >= start, Candidate.created_at < end, Candidate.status != 'processing'))).scalar() or 0
        gold = (await db.execute(text("SELECT count(*) FROM job_candidates WHERE classification = 'gold' AND matched_at >= :s AND matched_at < :e"), {"s": start, "e": end})).scalar() or 0
        weeks.append({"week": f"W-{i}", "start": start.strftime("%m/%d"), "uploads": uploads, "gold": gold})

    weeks.reverse()
    return {"weeks": weeks}
