"""AI Usage statistics endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.bedrock import calculate_cost
from app.database import get_db
from app.deps import get_current_user
from app.models import AIUsageLog, User

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
