"""Container health worker — disk usage polling and alert generation."""

import logging
from backend.src.database import AsyncSessionLocal
from backend.src.services.monitoring_service import persist_health_snapshot, check_threshold_alert
from backend.src.workers.broker import broker

logger = logging.getLogger(__name__)


@broker.task
async def poll_container_health():
    """
    T022 [US1]: Poll container health metrics and generate disk alerts.
    Designed to run on a schedule (e.g., every 5 minutes).
    """
    async with AsyncSessionLocal() as db:
        try:
            # Persist snapshot
            metric = await persist_health_snapshot(db)
            logger.info(
                "Health snapshot: disk=%.1f%%, memory=%.1f%%",
                float(metric.disk_usage_percent),
                float(metric.memory_usage_percent),
            )

            # Check threshold
            alert = await check_threshold_alert(db)
            if alert:
                logger.warning("Disk threshold alert: %s", alert)
                # In production, send notification via webhook/email

        except Exception as e:
            logger.error("Container health poll failed: %s", e)


# Schedule: run every 5 minutes
# broker.schedule_task(poll_container_health, crontab="*/5 * * * *")
