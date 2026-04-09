"""Finance service — cost aggregation and token-based estimation."""

import logging
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models.financial_record import FinancialRecord, FinancialRecordType

logger = logging.getLogger(__name__)


def _get_model_pricing(model_name: str = "gpt-4o-mini") -> dict:
    """Fetch pricing from config_store MODEL_INFO, with safe fallback."""
    try:
        from backend.config_store import get_model_pricing
        pricing = get_model_pricing(model_name)
        if pricing:
            return {
                "input": Decimal(str(pricing.get("input", 0.00000015))),
                "output": Decimal(str(pricing.get("output", 0.0000006))),
            }
    except ImportError:
        pass
    # Fallback defaults (gpt-4o-mini pricing)
    return {
        "input": Decimal("0.00000015"),
        "output": Decimal("0.0000006"),
    }



async def get_finance_summary(
    db: AsyncSession,
    start_date: date,
    end_date: date,
) -> Dict[str, Any]:
    """Return aggregated cost summary for the given period."""
    filters = and_(
        FinancialRecord.period_start >= datetime.combine(start_date, datetime.min.time()),
        FinancialRecord.period_end <= datetime.combine(end_date, datetime.max.time()),
    )

    # Totals
    totals_q = await db.execute(
        select(
            func.coalesce(func.sum(FinancialRecord.estimated_cost), 0).label("total_cost"),
            func.coalesce(func.sum(FinancialRecord.token_count), 0).label("total_tokens"),
        ).where(filters)
    )
    row = totals_q.one()

    # By service (type)
    by_service_q = await db.execute(
        select(
            FinancialRecord.type,
            func.sum(FinancialRecord.estimated_cost).label("cost"),
            func.sum(FinancialRecord.token_count).label("token_count"),
        )
        .where(filters)
        .group_by(FinancialRecord.type)
    )
    by_service = [
        {"service": str(r.type.value) if hasattr(r.type, 'value') else str(r.type), "cost": float(r.cost or 0), "token_count": int(r.token_count or 0)}
        for r in by_service_q.all()
    ]

    # Daily trend
    daily_q = await db.execute(
        select(
            cast(FinancialRecord.period_start, Date).label("day"),
            func.sum(FinancialRecord.estimated_cost).label("cost"),
        )
        .where(filters)
        .group_by("day")
        .order_by("day")
    )
    daily_trend = [
        {"date": str(r.day), "cost": float(r.cost or 0)}
        for r in daily_q.all()
    ]

    return {
        "total_cost": float(row.total_cost),
        "total_tokens": int(row.total_tokens),
        "by_service": by_service,
        "daily_trend": daily_trend,
    }


async def get_agent_cost_detail(
    db: AsyncSession,
    agent_id: UUID,
    start_date: date,
    end_date: date,
) -> Dict[str, Any]:
    """Return per-agent cost details broken down by skill and type."""
    filters = and_(
        FinancialRecord.agent_id == agent_id,
        FinancialRecord.period_start >= datetime.combine(start_date, datetime.min.time()),
        FinancialRecord.period_end <= datetime.combine(end_date, datetime.max.time()),
    )

    breakdown_q = await db.execute(
        select(
            FinancialRecord.skill_id,
            FinancialRecord.type,
            func.sum(FinancialRecord.token_count).label("token_count"),
            func.sum(FinancialRecord.estimated_cost).label("estimated_cost"),
        )
        .where(filters)
        .group_by(FinancialRecord.skill_id, FinancialRecord.type)
    )

    cost_by_skill: List[Dict[str, Any]] = []
    total = Decimal("0")
    for r in breakdown_q.all():
        cost = Decimal(str(r.estimated_cost or 0))
        total += cost
        cost_by_skill.append({
            "skill_id": str(r.skill_id) if r.skill_id else None,
            "skill_name": "",  # Filled by caller if needed
            "type": str(r.type.value) if hasattr(r.type, 'value') else str(r.type),
            "token_count": int(r.token_count or 0),
            "estimated_cost": float(cost),
        })

    return {
        "agent_id": str(agent_id),
        "agent_name": "",  # Filled by caller if needed
        "cost_by_skill": cost_by_skill,
        "total_cost": float(total),
    }


async def get_records_for_export(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    agent_id: Optional[UUID] = None,
    record_type: Optional[str] = None,
) -> List[FinancialRecord]:
    """Return raw records for CSV export."""
    filters = [
        FinancialRecord.period_start >= datetime.combine(start_date, datetime.min.time()),
        FinancialRecord.period_end <= datetime.combine(end_date, datetime.max.time()),
    ]
    if agent_id:
        filters.append(FinancialRecord.agent_id == agent_id)
    if record_type:
        filters.append(FinancialRecord.type == record_type)

    result = await db.execute(
        select(FinancialRecord).where(and_(*filters)).order_by(FinancialRecord.period_start)
    )
    return list(result.scalars().all())


def estimate_cost(token_count: int, is_input: bool = True, model_name: str = "gpt-4o-mini") -> Decimal:
    """Estimate cost in USD given a token count, using MODEL_INFO pricing."""
    pricing = _get_model_pricing(model_name)
    price = pricing["input"] if is_input else pricing["output"]
    return Decimal(str(token_count)) * price

