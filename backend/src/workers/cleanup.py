import logging
from datetime import datetime, timedelta
from sqlalchemy import delete
from backend.src.database import AsyncSessionLocal
from backend.src.models.stress_test import StressTestSession
from backend.src.workers.broker import broker

logger = logging.getLogger(__name__)

@broker.task
async def cleanup_old_stress_tests(days_to_keep: int = 30):
    """
    CRON/Background job to purge old stress test sessions and reports.
    (FR-012: Report Cleanup Policy)
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
    
    async with AsyncSessionLocal() as db:
        try:
            # Delete sessions older than the cutoff
            query = delete(StressTestSession).where(StressTestSession.created_at < cutoff_date)
            result = await db.execute(query)
            await db.commit()
            
            logger.info(f"Cleanup completed: Purged {result.rowcount} stress test sessions.")
        except Exception as e:
            logger.error(f"Cleanup failed: {e}")
            await db.rollback()

# Note: In a production setup, we would register this in TaskIQ scheduler/cron.
