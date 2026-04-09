"""Finance API — cost analysis, agent detail, and CSV export endpoints."""

import csv
import io
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.database import get_db
from backend.src.api.auth import get_owner_or_superadmin
from backend.src.models.schemas import SuccessResponse
from backend.src.services.finance_service import (
    get_finance_summary,
    get_agent_cost_detail,
    get_records_for_export,
)

router = APIRouter()


@router.get("/summary", response_model=SuccessResponse)
async def finance_summary(
    start_date: date = Query(..., description="Period start (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_owner_or_superadmin),
):
    """T025 [US2]: Return total cost, token volume, service breakdown, and daily trend."""
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    data = await get_finance_summary(db, start_date, end_date)
    return SuccessResponse(data=data)


@router.get("/agent/{agent_id}", response_model=SuccessResponse)
async def finance_agent_detail(
    agent_id: UUID,
    start_date: date = Query(..., description="Period start (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_owner_or_superadmin),
):
    """T026 [US2]: Return per-agent cost details by skill and type."""
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    data = await get_agent_cost_detail(db, agent_id, start_date, end_date)
    return SuccessResponse(data=data)


@router.get("/export")
async def finance_export(
    start_date: date = Query(..., description="Period start (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Period end (YYYY-MM-DD)"),
    agent_id: Optional[UUID] = Query(None, description="Filter by agent"),
    type: Optional[str] = Query(None, description="Filter by type: chat, fine_tuning, ingestion"),
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_owner_or_superadmin),
):
    """T027 [US2]: Export filtered financial records as CSV."""
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be <= end_date")

    records = await get_records_for_export(db, start_date, end_date, agent_id, type)

    # Build CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "agent_id", "skill_id", "token_count", "estimated_cost",
        "type", "period_start", "period_end",
    ])
    for r in records:
        writer.writerow([
            str(r.agent_id),
            str(r.skill_id) if r.skill_id else "",
            r.token_count,
            float(r.estimated_cost),
            r.type.value if hasattr(r.type, 'value') else str(r.type),
            r.period_start.isoformat() if r.period_start else "",
            r.period_end.isoformat() if r.period_end else "",
        ])

    output.seek(0)
    filename = f"finance_export_{start_date}_{end_date}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
