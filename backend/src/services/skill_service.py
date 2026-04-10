import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from src.models.skill import Skill, SkillType, SkillStatus, SkillVersion
from src.services.skill_version_service import SkillVersionService
from src.services.skill_ingestion_service import start_ingestion_job

class SkillService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_hybrid_skill(self, name: str, description: Optional[str] = None) -> Skill:
        new_skill = Skill(
            id=uuid.uuid4(),
            name=name,
            description=description,
            type=SkillType.hibrida,
            status=SkillStatus.draft
        )
        self.db.add(new_skill)
        await self.db.commit()
        await self.db.refresh(new_skill)
        return new_skill

    async def get_skill(self, skill_id: uuid.UUID) -> Optional[Skill]:
        result = await self.db.execute(select(Skill).filter(Skill.id == skill_id))
        return result.scalars().first()

    async def list_skills(self) -> List[Skill]:
        result = await self.db.execute(select(Skill))
        return result.scalars().all()

    async def start_ingestion(self, skill_id: uuid.UUID):
        """Creates a pending version and queues ingestion"""
        skill = await self.get_skill(skill_id)
        if not skill:
            raise ValueError("Skill not found")
            
        version_service = SkillVersionService(self.db)
        new_version = await version_service.create_pending_version(skill_id)
        
        await start_ingestion_job(new_version.id)
        return new_version

    async def validate_target_table(self, table_name: str, id_column: str = "product_id") -> bool:
        """Validates if a Postgres table and its mapping column exist"""
        try:
            query = text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = :table_name 
                AND column_name = :id_column
            """)
            result = await self.db.execute(query, {"table_name": table_name, "id_column": id_column})
            return result.scalar() is not None
        except Exception:
            return False
