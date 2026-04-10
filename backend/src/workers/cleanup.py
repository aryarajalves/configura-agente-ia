"""Cleanup worker — TaskIQ tasks for audit log and data retention."""

import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, select, update
from src.database import AsyncSessionLocal
from src.models.audit import AuditLog
from src.models.stress_test import StressTestSession
from src.models.cleanup_job import CleanupJob, CleanupJobStatus
from src.models.system_settings import SystemSettings
from src.workers.broker import broker

logger = logging.getLogger(__name__)

# Max consecutive failures before notifying the Dono (T021A)
MAX_CONSECUTIVE_FAILURES = 3


async def _get_retention_days() -> int:
    """Fetch current retention period from system settings."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings).limit(1))
        settings = result.scalars().first()
        return settings.retention_period_days if settings else 90


async def _get_or_create_cleanup_job(db, task_name: str) -> CleanupJob:
    """Get or create the cleanup job tracking record."""
    result = await db.execute(
        select(CleanupJob).where(CleanupJob.task_name == task_name)
    )
    job = result.scalars().first()
    if not job:
        job = CleanupJob(
            id=uuid.uuid4(),
            task_name=task_name,
            status=CleanupJobStatus.PENDING,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
    return job


async def _mark_job_success(db, job: CleanupJob) -> None:
    """Mark job as succeeded and reset failure count."""
    job.status = CleanupJobStatus.SUCCESS
    job.last_run_at = datetime.utcnow()
    job.failure_count = 0
    job.error_message = None
    job.updated_at = datetime.utcnow()
    await db.commit()

    # Also stamp last_cleanup_timestamp on system settings
    from src.services.settings_service import mark_cleanup_completed
    await mark_cleanup_completed(db)


async def _mark_job_failed(db, job: CleanupJob, error: str) -> None:
    """Mark job as failed, increment failure count, and check for alert threshold."""
    job.status = CleanupJobStatus.FAILED
    job.last_run_at = datetime.utcnow()
    job.failure_count += 1
    job.error_message = error
    job.updated_at = datetime.utcnow()
    await db.commit()

    # T021A: Notify after MAX_CONSECUTIVE_FAILURES
    if job.failure_count >= MAX_CONSECUTIVE_FAILURES:
        logger.critical(
            "⚠️ ALERTA: Cleanup job '%s' falhou %d vezes consecutivas. "
            "Última falha: %s. O Dono deve ser notificado.",
            job.task_name,
            job.failure_count,
            error,
        )
        # In production, this would trigger a notification via email/webhook


@broker.task
async def cleanup_audit_logs():
    """
    T020 [US1]: Remove audit logs older than the configured retention period.
    T020A [US1]: Scheduled daily via TaskIQ.
    T021 [US1]: Track cleanup job state.
    T021A [US1]: Alert after 3 consecutive failures.
    """
    retention_days = await _get_retention_days()
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

    async with AsyncSessionLocal() as db:
        job = await _get_or_create_cleanup_job(db, "cleanup_audit_logs")
        job.status = CleanupJobStatus.RUNNING
        job.updated_at = datetime.utcnow()
        await db.commit()

        try:
            query = delete(AuditLog).where(AuditLog.timestamp < cutoff_date)
            result = await db.execute(query)
            await db.commit()

            logger.info(
                "Cleanup audit_logs completed: purged %d records older than %d days.",
                result.rowcount,
                retention_days,
            )
            await _mark_job_success(db, job)
        except Exception as e:
            logger.error("Cleanup audit_logs failed: %s", e)
            await db.rollback()
            await _mark_job_failed(db, job, str(e))


@broker.task
async def cleanup_old_stress_tests(days_to_keep: int = 30):
    """
    CRON/Background job to purge old stress test sessions and reports.
    (FR-012: Report Cleanup Policy)
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)

    async with AsyncSessionLocal() as db:
        job = await _get_or_create_cleanup_job(db, "cleanup_stress_tests")
        job.status = CleanupJobStatus.RUNNING
        job.updated_at = datetime.utcnow()
        await db.commit()

        try:
            query = delete(StressTestSession).where(StressTestSession.created_at < cutoff_date)
            result = await db.execute(query)
            await db.commit()

            logger.info("Cleanup stress_tests completed: purged %d sessions.", result.rowcount)
            await _mark_job_success(db, job)
        except Exception as e:
            logger.error("Cleanup stress_tests failed: %s", e)
            await db.rollback()
            await _mark_job_failed(db, job, str(e))


@broker.task
async def cleanup_old_health_metrics(days_to_keep: int = 30):
    """Purge old container health metrics to control table growth."""
    from src.models.container_health_metric import ContainerHealthMetric

    cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)

    async with AsyncSessionLocal() as db:
        job = await _get_or_create_cleanup_job(db, "cleanup_health_metrics")
        job.status = CleanupJobStatus.RUNNING
        job.updated_at = datetime.utcnow()
        await db.commit()

        try:
            query = delete(ContainerHealthMetric).where(ContainerHealthMetric.timestamp < cutoff_date)
            result = await db.execute(query)
            await db.commit()

            logger.info("Cleanup health_metrics completed: purged %d records.", result.rowcount)
            await _mark_job_success(db, job)
        except Exception as e:
            logger.error("Cleanup health_metrics failed: %s", e)
            await db.rollback()
            await _mark_job_failed(db, job, str(e))


# T020A: Schedule daily recurrence
# In production, use TaskIQ scheduler or cron-like configuration:
# broker.schedule_task(cleanup_audit_logs, crontab="0 3 * * *")  # Daily at 3 AM
# broker.schedule_task(cleanup_old_stress_tests, crontab="0 4 * * *")
# broker.schedule_task(cleanup_old_health_metrics, crontab="0 5 * * *")
