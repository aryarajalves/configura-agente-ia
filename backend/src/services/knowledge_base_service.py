"""
knowledge_base_service.py  (formerly skill_service.py)
Manages KnowledgeBase CRUD and ingestion orchestration.
"""
import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from src.models.knowledge_base import KnowledgeBase, KnowledgeBaseType, KnowledgeBaseStatus, KnowledgeBaseVersion
from src.services.knowledge_base_version_service import KnowledgeBaseVersionService
from src.services.skill_ingestion_service import start_ingestion_job


class KnowledgeBaseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_hybrid_knowledge_base(self, name: str, description: Optional[str] = None) -> KnowledgeBase:
        new_kb = KnowledgeBase(
            id=uuid.uuid4(),
            name=name,
            description=description,
            type=KnowledgeBaseType.hibrida,
            status=KnowledgeBaseStatus.draft
        )
        self.db.add(new_kb)
        await self.db.commit()
        await self.db.refresh(new_kb)
        return new_kb

    # Legacy alias
    async def create_hybrid_skill(self, name: str, description: Optional[str] = None) -> KnowledgeBase:
        return await self.create_hybrid_knowledge_base(name, description)

    async def get_knowledge_base(self, kb_id: uuid.UUID) -> Optional[KnowledgeBase]:
        result = await self.db.execute(select(KnowledgeBase).filter(KnowledgeBase.id == kb_id))
        return result.scalars().first()

    # Legacy alias
    async def get_skill(self, skill_id: uuid.UUID) -> Optional[KnowledgeBase]:
        return await self.get_knowledge_base(skill_id)

    async def list_knowledge_bases(self) -> List[KnowledgeBase]:
        result = await self.db.execute(select(KnowledgeBase))
        return result.scalars().all()

    # Legacy alias
    async def list_skills(self) -> List[KnowledgeBase]:
        return await self.list_knowledge_bases()

    async def start_ingestion(self, kb_id: uuid.UUID):
        """Creates a pending version and queues ingestion"""
        kb = await self.get_knowledge_base(kb_id)
        if not kb:
            raise ValueError("Knowledge base not found")
            
        version_service = KnowledgeBaseVersionService(self.db)
        new_version = await version_service.create_pending_version(kb_id)
        
        await start_ingestion_job(new_version.id)
        return new_version

    async def validate_target_table(self, table_name: str, id_column: str = "product_id") -> bool:
        """Validates if a Postgres table and its mapping column exist"""
        try:
            query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = :table_name 
                AND column_name = :id_column
            """)
            result = await self.db.execute(query, {"table_name": table_name, "id_column": id_column})
            return result.scalar() is not None
        except Exception:
            return False


# Backward-compatibility alias
SkillService = KnowledgeBaseService
