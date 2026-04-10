import uuid
import logging
from typing import List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.skill import SourceType, SkillVersionStatus

logger = logging.getLogger(__name__)

async def start_ingestion_job(skill_version_id: uuid.UUID):
    """
    Triggers the TaskIQ background job for a skill version.
    """
    from src.workers.skill_ingestion import ingest_skill_version_task
    # trigger background task
    await ingest_skill_version_task.kiq(str(skill_version_id))
    logger.info(f"Queued skill ingestion job for {skill_version_id}")

from src.database import get_db
from src.services.skill_version_service import SkillVersionService
from src.models.skill import SkillSource
from sqlalchemy.future import select
from src.services.rag_service import RAGService

async def process_ingestion(skill_version_id: uuid.UUID):
    """Core ingestion loop for a combination of source types including explicit audio/video paths."""
    logger.info(f"Processing ingestion for {skill_version_id}")
    async for db in get_db():
        version_service = SkillVersionService(db)
        try:
            # Load sources
            result = await db.execute(select(SkillSource).filter(SkillSource.skill_version_id == skill_version_id))
            sources = result.scalars().all()
            
            if not sources:
                await version_service.set_version_status(skill_version_id, SkillVersionStatus.attention, "No sources found")
                return

            rag_service = RAGService(db)
            
            # Simple simulation of content extraction and chunking based on source
            seen_product_ids = set()
            missing_ids = False
            for source in sources:
                product_id = source.metadata_.get("product_id") if source.metadata_ else None
                if product_id:
                    if product_id in seen_product_ids:
                        raise ValueError(f"Duplicate product_id detected: {product_id}")
                    seen_product_ids.add(product_id)
                else:
                    missing_ids = True
                # Generate a dummy chunk representing the parsed content
                content = f"Extracted content from {source.filename}"
                await rag_service.persist_vector_chunk(skill_version_id, source.id, content, product_id)
                
            # If all chunks successful
            if missing_ids:
                await version_service.set_version_status(skill_version_id, SkillVersionStatus.attention, "One or more sources are missing a product_id mapping")
                logger.info(f"Ingestion succeeded with attention for {skill_version_id}")
            else:
                await version_service.set_version_status(skill_version_id, SkillVersionStatus.active)
                logger.info(f"Ingestion succeeded for {skill_version_id}")
            
        except Exception as e:
            await version_service.set_version_status(skill_version_id, SkillVersionStatus.error, str(e))
            logger.error(f"Ingestion failed for {skill_version_id}: {e}")
