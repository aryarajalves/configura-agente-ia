import logging
from backend.src.workers.broker import broker
import uuid

logger = logging.getLogger(__name__)

@broker.task(queue="skill_ingestion")
async def ingest_skill_version_task(skill_version_id: str) -> dict:
    """
    TaskIQ background job that processes a hybrid skill version.
    """
    from backend.src.services.skill_ingestion_service import process_ingestion
    
    logger.info(f"Starting ingestion process for skill_version_id: {skill_version_id}")
    try:
        await process_ingestion(uuid.UUID(skill_version_id))
        return {"status": "success", "skill_version_id": skill_version_id}
    except Exception as e:
        logger.error(f"Error ingesting skill_version {skill_version_id}: {e}")
        return {"status": "error", "error": str(e)}
