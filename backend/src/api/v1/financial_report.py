"""
financial_report.py — Alias route for GET /v1/financial/report
Returns Financeiro-page-compatible JSON: { items: [...], grand_total_cost: float }
"""
from fastapi import APIRouter, Depends, Query
from datetime import date, timedelta, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, and_
from typing import Optional

from src.database import get_db
from src.api.auth import get_owner_or_superadmin
from src.models.schemas import SuccessResponse
from src.models.financial_record import FinancialRecord
from src.models.agent import Agent

router = APIRouter()


@router.get("/report")
async def finance_report(
    start_date: Optional[date] = Query(default=None, description="Period start (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(default=None, description="Period end (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_owner_or_superadmin),
):
    """
    Financeiro-compatible report endpoint.
    Returns { items: [per-agent daily rows], grand_total_cost: float }
    """
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = today - timedelta(days=30)
    if start_date > end_date:
        start_date = end_date

    filters = and_(
        FinancialRecord.period_start >= datetime.combine(start_date, datetime.min.time()),
        FinancialRecord.period_end <= datetime.combine(end_date, datetime.max.time()),
    )

    # Per-agent, per-day aggregation
    rows_q = await db.execute(
        select(
            cast(FinancialRecord.period_start, Date).label("date"),
            FinancialRecord.agent_id,
            func.count(FinancialRecord.id).label("total_messages"),
            func.sum(FinancialRecord.token_count).label("total_tokens"),
            func.sum(FinancialRecord.estimated_cost).label("total_cost"),
            func.count(FinancialRecord.id.distinct()).label("unique_sessions"),
        )
        .where(filters)
        .group_by("date", FinancialRecord.agent_id)
        .order_by("date")
    )

    # Get agent names in bulk
    all_agent_ids = set()
    raw_rows = rows_q.all()
    for r in raw_rows:
        if r.agent_id:
            all_agent_ids.add(r.agent_id)

    agent_names: dict = {}
    if all_agent_ids:
        agents_q = await db.execute(select(Agent).where(Agent.id.in_(all_agent_ids)))
        for a in agents_q.scalars().all():
            agent_names[str(a.id)] = a.name or "Agente"

    items = []
    grand_total = 0.0
    for r in raw_rows:
        cost = float(r.total_cost or 0)
        msgs = int(r.total_messages or 0)
        grand_total += cost
        items.append({
            "date": str(r.date),
            "agent_id": str(r.agent_id) if r.agent_id else None,
            "agent_name": agent_names.get(str(r.agent_id), "Excluído") if r.agent_id else "Excluído",
            "total_messages": msgs,
            "total_tokens": int(r.total_tokens or 0),
            "total_cost": cost,
            "avg_cost_per_message": (cost / msgs) if msgs > 0 else 0,
            "unique_sessions": int(r.unique_sessions or 0),
        })

    return {"items": items, "grand_total_cost": round(grand_total, 6)}

