from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.src.database import get_db
from backend.src.models.audit import AuditLog
from backend.src.api.auth import get_superadmin
from backend.src.models.schemas import SuccessResponse
from typing import List

router = APIRouter()

@router.get("/", response_model=SuccessResponse)
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    # FR-014: Access restricted to SUPERADMIN
    result = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100))
    logs = result.scalars().all()
    return SuccessResponse(data=logs)
