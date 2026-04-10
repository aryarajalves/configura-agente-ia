"""System Settings API — retention and alert configuration endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.api.auth import get_superadmin
from src.models.schemas import SuccessResponse
from src.services.settings_service import get_or_create_settings, update_settings

router = APIRouter()


class SettingsUpdateRequest(BaseModel):
    retention_period_days: Optional[int] = Field(None, ge=1, description="Retention period in days")
    storage_threshold_alert: Optional[int] = Field(None, ge=1, le=100, description="Storage alert threshold %")


@router.get("/", response_model=SuccessResponse)
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin),
):
    """T018 [US1]: Return current retention and alert configuration."""
    settings = await get_or_create_settings(db)
    return SuccessResponse(data={
        "retention_period_days": settings.retention_period_days,
        "storage_threshold_alert": settings.storage_threshold_alert,
        "last_cleanup_timestamp": settings.last_cleanup_timestamp.isoformat() if settings.last_cleanup_timestamp else None,
        "updated_by": str(settings.updated_by) if settings.updated_by else None,
        "updated_at": settings.updated_at.isoformat() if settings.updated_at else None,
    })


@router.patch("/", response_model=SuccessResponse)
async def patch_system_settings(
    body: SettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin),
):
    """T019 [US1]: Update retention_period_days and storage_threshold_alert."""
    try:
        settings = await update_settings(
            db,
            retention_period_days=body.retention_period_days,
            storage_threshold_alert=body.storage_threshold_alert,
            updated_by=admin.get("id"),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return SuccessResponse(
        data={
            "retention_period_days": settings.retention_period_days,
            "storage_threshold_alert": settings.storage_threshold_alert,
            "last_cleanup_timestamp": settings.last_cleanup_timestamp.isoformat() if settings.last_cleanup_timestamp else None,
            "updated_by": str(settings.updated_by) if settings.updated_by else None,
            "updated_at": settings.updated_at.isoformat() if settings.updated_at else None,
        },
        message="Configurações atualizadas com sucesso",
    )

