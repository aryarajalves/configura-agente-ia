"""
knowledge_base_version_service.py  (formerly skill_version_service.py)
Manages KnowledgeBaseVersion lifecycle.
"""
import uuid
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from src.models.knowledge_base import KnowledgeBase, KnowledgeBaseVersion, KnowledgeBaseVersionStatus, KnowledgeBaseStatus


class KnowledgeBaseVersionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_pending_version(self, kb_id: uuid.UUID) -> KnowledgeBaseVersion:
        result = await self.db.execute(
            select(KnowledgeBaseVersion)
            .filter(KnowledgeBaseVersion.knowledge_base_id == kb_id)
            .order_by(desc(KnowledgeBaseVersion.version_number))
        )
        latest_version = result.scalars().first()
        next_version_num = (latest_version.version_number + 1) if latest_version else 1

        new_version = KnowledgeBaseVersion(
            id=uuid.uuid4(),
            knowledge_base_id=kb_id,
            version_number=next_version_num,
            status=KnowledgeBaseVersionStatus.processing,
            source_count=0
        )
        self.db.add(new_version)
        await self.db.commit()
        await self.db.refresh(new_version)
        return new_version

    async def get_version(self, version_id: uuid.UUID) -> Optional[KnowledgeBaseVersion]:
        result = await self.db.execute(select(KnowledgeBaseVersion).filter(KnowledgeBaseVersion.id == version_id))
        return result.scalars().first()

    async def list_versions(self, kb_id: uuid.UUID) -> List[KnowledgeBaseVersion]:
        result = await self.db.execute(
            select(KnowledgeBaseVersion)
            .filter(KnowledgeBaseVersion.knowledge_base_id == kb_id)
            .order_by(desc(KnowledgeBaseVersion.version_number))
        )
        return list(result.scalars().all())

    async def set_version_status(self, version_id: uuid.UUID, status: KnowledgeBaseVersionStatus, error_message: str = None) -> Optional[KnowledgeBaseVersion]:
        version = await self.get_version(version_id)
        if not version:
            return None
        
        version.status = status
        if error_message:
            version.error_message = error_message
        
        if status in [KnowledgeBaseVersionStatus.active, KnowledgeBaseVersionStatus.attention, KnowledgeBaseVersionStatus.error]:
            version.processed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(version)
        return version

    async def activate_version(self, kb_id: uuid.UUID, version_id: uuid.UUID) -> Optional[KnowledgeBaseVersion]:
        version = await self.get_version(version_id)
        if not version:
            return None
            
        kb_result = await self.db.execute(select(KnowledgeBase).filter(KnowledgeBase.id == kb_id))
        kb = kb_result.scalars().first()
        
        if not kb:
            return None

        version.status = KnowledgeBaseVersionStatus.active
        version.activated_at = datetime.utcnow()
        kb.active_version_id = version.id
        kb.status = KnowledgeBaseStatus.active

        await self.db.commit()
        await self.db.refresh(version)
        await self.db.refresh(kb)
        return version


# Backward-compatibility alias
SkillVersionService = KnowledgeBaseVersionService
