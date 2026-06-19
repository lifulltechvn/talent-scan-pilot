"""AI Usage statistics endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bedrock import calculate_cost
from app.database import get_db
from app.deps import get_current_user
from app.models import AIUsageLog, Candidate, User

router = APIRouter(prefix="/ai-usage", tags=["ai-usage"])


class UsageLogRequest(BaseModel):
    model_id: str
    feature: str
    input_tokens: int
    output_tokens: int
    source: str = "desktop"


@router.post("/log", status_code=201)
async def log_usage(
    body: UsageLogRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Receive usage log from desktop app."""
    db.add(AIUsageLog(
        model_id=body.model_id,
        feature=body.feature,
        input_tokens=body.input_tokens,
        output_tokens=body.output_tokens,
        cost_usd=calculate_cost(body.model_id, body.input_tokens, body.output_tokens),
        source=body.source,
    ))
    await db.commit()
    return {"status": "ok"}


@router.get("/summary")
async def get_usage_summary(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get aggregated usage summary for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total
    total_q = await db.execute(
        select(
            func.count(AIUsageLog.id),
            func.coalesce(func.sum(AIUsageLog.input_tokens), 0),
            func.coalesce(func.sum(AIUsageLog.output_tokens), 0),
            func.coalesce(func.sum(AIUsageLog.cost_usd), 0),
        ).where(AIUsageLog.created_at >= since)
    )
    total = total_q.one()

    # By feature
    by_feature_q = await db.execute(
        select(
            AIUsageLog.feature,
            func.count(AIUsageLog.id),
            func.sum(AIUsageLog.input_tokens),
            func.sum(AIUsageLog.output_tokens),
            func.sum(AIUsageLog.cost_usd),
        ).where(AIUsageLog.created_at >= since)
        .group_by(AIUsageLog.feature)
    )

    # By model
    by_model_q = await db.execute(
        select(
            AIUsageLog.model_id,
            func.count(AIUsageLog.id),
            func.sum(AIUsageLog.input_tokens),
            func.sum(AIUsageLog.output_tokens),
            func.sum(AIUsageLog.cost_usd),
        ).where(AIUsageLog.created_at >= since)
        .group_by(AIUsageLog.model_id)
    )

    return {
        "period_days": days,
        "total": {
            "calls": total[0],
            "input_tokens": int(total[1]),
            "output_tokens": int(total[2]),
            "cost_usd": round(float(total[3]), 6),
        },
        "by_feature": [
            {"feature": r[0], "calls": r[1], "input_tokens": int(r[2]), "output_tokens": int(r[3]), "cost_usd": round(float(r[4]), 6)}
            for r in by_feature_q.all()
        ],
        "by_model": [
            {"model_id": r[0], "calls": r[1], "input_tokens": int(r[2]), "output_tokens": int(r[3]), "cost_usd": round(float(r[4]), 6)}
            for r in by_model_q.all()
        ],
    }


@router.get("/daily")
async def get_daily_usage(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get daily breakdown for charting."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(AIUsageLog.created_at).label("date"),
            func.count(AIUsageLog.id),
            func.sum(AIUsageLog.input_tokens),
            func.sum(AIUsageLog.output_tokens),
            func.sum(AIUsageLog.cost_usd),
        ).where(AIUsageLog.created_at >= since)
        .group_by(func.date(AIUsageLog.created_at))
        .order_by(func.date(AIUsageLog.created_at))
    )

    return [
        {"date": str(r[0]), "calls": r[1], "input_tokens": int(r[2]), "output_tokens": int(r[3]), "cost_usd": round(float(r[4]), 6)}
        for r in result.all()
    ]


@router.get("/per-candidate")
async def get_per_candidate_usage(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get AI cost breakdown per candidate."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            AIUsageLog.candidate_id,
            func.count(AIUsageLog.id),
            func.sum(AIUsageLog.input_tokens),
            func.sum(AIUsageLog.output_tokens),
            func.sum(AIUsageLog.cost_usd),
        ).where(AIUsageLog.created_at >= since, AIUsageLog.candidate_id.isnot(None))
        .group_by(AIUsageLog.candidate_id)
        .order_by(func.sum(AIUsageLog.cost_usd).desc())
        .limit(100)
    )
    rows = result.all()

    # Get candidate names
    cand_ids = [r[0] for r in rows]
    names_map = {}
    if cand_ids:
        cands = await db.execute(select(Candidate.id, Candidate.structured_data).where(Candidate.id.in_(cand_ids)))
        for c in cands.all():
            names_map[str(c[0])] = (c[1] or {}).get("name", "Unknown")

    return [
        {
            "candidate_id": str(r[0]),
            "candidate_name": names_map.get(str(r[0]), "Unknown"),
            "calls": r[1],
            "input_tokens": int(r[2]),
            "output_tokens": int(r[3]),
            "cost_usd": round(float(r[4]), 6),
        }
        for r in rows
    ]


@router.get("/candidate/{candidate_id}")
async def get_candidate_usage_detail(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get detailed AI usage breakdown for a specific candidate."""
    result = await db.execute(
        select(
            AIUsageLog.feature,
            AIUsageLog.model_id,
            AIUsageLog.input_tokens,
            AIUsageLog.output_tokens,
            AIUsageLog.cost_usd,
            AIUsageLog.created_at,
        ).where(AIUsageLog.candidate_id == candidate_id)
        .order_by(AIUsageLog.created_at)
    )
    rows = result.all()

    total_cost = sum(r[4] for r in rows)
    total_input = sum(r[2] for r in rows)
    total_output = sum(r[3] for r in rows)

    return {
        "candidate_id": candidate_id,
        "total_calls": len(rows),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_cost_usd": round(total_cost, 6),
        "details": [
            {
                "feature": r[0],
                "model": r[1].split(".")[-1] if "." in r[1] else r[1],
                "input_tokens": r[2],
                "output_tokens": r[3],
                "cost_usd": round(r[4], 6),
                "timestamp": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ],
    }


@router.get("/logs")
async def get_usage_logs(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get all AI usage logs with full detail."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(AIUsageLog)
        .where(AIUsageLog.created_at >= since)
        .order_by(AIUsageLog.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()

    # Get candidate names
    cand_ids = list({r.candidate_id for r in rows if r.candidate_id})
    names_map = {}
    if cand_ids:
        cands = await db.execute(select(Candidate.id, Candidate.structured_data).where(Candidate.id.in_(cand_ids)))
        for c in cands.all():
            names_map[str(c[0])] = (c[1] or {}).get("name", "Unknown")

    return [
        {
            "id": str(r.id),
            "feature": r.feature,
            "model": r.model_id.split(".")[-1] if "." in r.model_id else r.model_id,
            "model_full": r.model_id,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "cost_usd": round(r.cost_usd, 6),
            "source": r.source,
            "candidate_id": str(r.candidate_id) if r.candidate_id else None,
            "candidate_name": names_map.get(str(r.candidate_id), None) if r.candidate_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
