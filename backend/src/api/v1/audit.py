"""Audit log API — filterable, paginated, with authorization."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import date, datetime
from uuid import UUID

from backend.src.database import get_db
from backend.src.models.audit import AuditLog
from backend.src.api.auth import get_superadmin
from backend.src.models.schemas import SuccessResponse

router = APIRouter()


@router.get("/", response_model=SuccessResponse)
async def list_audit_logs(
    start_date: Optional[date] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    user_id: Optional[UUID] = Query(None, description="Filter by superadmin user ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin),
):
    """List audit logs with optional filtering, ordering, and pagination.

    - FR-014: Access restricted to SUPERADMIN
    - T017: Authorization, result ordering, and filtering extension points
    - T031/T032: Query parameters and pagination support
    """
    filters = []

    if start_date:
        filters.append(AuditLog.timestamp >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        filters.append(AuditLog.timestamp <= datetime.combine(end_date, datetime.max.time()))
    if user_id:
        filters.append(AuditLog.superadmin_id == user_id)
    if action:
        filters.append(AuditLog.action == action)

    where_clause = and_(*filters) if filters else True

    # Total count for pagination
    count_q = await db.execute(select(func.count(AuditLog.id)).where(where_clause))
    total = count_q.scalar() or 0

    # Ordered results
    result = await db.execute(
        select(AuditLog)
        .where(where_clause)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()

    # Serialize with deleted_user_display preservation (T033)
    data = []
    for log in logs:
        entry = {
            "id": str(log.id),
            "agent_id": str(log.agent_id) if log.agent_id else None,
            "superadmin_id": str(log.superadmin_id),
            "action": log.action,
            "target_entity_type": log.target_entity_type,
            "target_entity_id": str(log.target_entity_id) if log.target_entity_id else None,
            "previous_state": log.previous_state,
            "new_state": log.new_state,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "deleted_user_display": log.deleted_user_display,
        }
        data.append(entry)

    return SuccessResponse(
        data={
            "data": data,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": total,
            },
        }
    )
