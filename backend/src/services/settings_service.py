"""Settings service — CRUD for governance retention and alert configuration."""

import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.system_settings import SystemSettings

logger = logging.getLogger(__name__)


async def get_or_create_settings(db: AsyncSession) -> SystemSettings:
    """Return the singleton SystemSettings row, creating it if absent."""
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalars().first()
    if settings is None:
        settings = SystemSettings(
            id=uuid.uuid4(),
            retention_period_days=90,
            storage_threshold_alert=80,
            updated_at=datetime.utcnow(),
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        logger.info("Created default SystemSettings row.")
    return settings


async def update_settings(
    db: AsyncSession,
    *,
    retention_period_days: Optional[int] = None,
    storage_threshold_alert: Optional[int] = None,
    updated_by: Optional[str] = None,
) -> SystemSettings:
    """Partially update system settings."""
    settings = await get_or_create_settings(db)

    previous_state = {
        "retention_period_days": settings.retention_period_days,
        "storage_threshold_alert": settings.storage_threshold_alert,
    }

    if retention_period_days is not None:
        if retention_period_days < 1:
            raise ValueError("retention_period_days must be >= 1")
        settings.retention_period_days = retention_period_days

    if storage_threshold_alert is not None:
        if not (1 <= storage_threshold_alert <= 100):
            raise ValueError("storage_threshold_alert must be between 1 and 100")
        settings.storage_threshold_alert = storage_threshold_alert

    settings.updated_at = datetime.utcnow()
    if updated_by:
        settings.updated_by = updated_by

    # T039: Create governance audit trail
    new_state = {
        "retention_period_days": settings.retention_period_days,
        "storage_threshold_alert": settings.storage_threshold_alert,
    }
    if previous_state != new_state:
        from src.models.audit import AuditLog
        audit_entry = AuditLog(
            id=uuid.uuid4(),
            superadmin_id=updated_by if updated_by else None,
            action="UPDATE_SETTINGS",
            target_entity_type="system_settings",
            target_entity_id=settings.id,
            previous_state=previous_state,
            new_state=new_state,
        )
        db.add(audit_entry)
        logger.info("Governance audit: settings change recorded.")

    await db.commit()
    await db.refresh(settings)
    logger.info(
        "SystemSettings updated: retention=%d days, threshold=%d%%",
        settings.retention_period_days,
        settings.storage_threshold_alert,
    )
    return settings


async def mark_cleanup_completed(db: AsyncSession) -> None:
    """Stamp the last_cleanup_timestamp on system settings."""
    settings = await get_or_create_settings(db)
    settings.last_cleanup_timestamp = datetime.utcnow()
    await db.commit()
