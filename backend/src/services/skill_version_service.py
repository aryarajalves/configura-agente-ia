import uuid
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from src.models.knowledge_base import Skill, SkillVersion, SkillVersionStatus, SkillStatus

class SkillVersionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_pending_version(self, skill_id: uuid.UUID) -> SkillVersion:
        # Get latest version number
        result = await self.db.execute(
            select(SkillVersion)
            .filter(SkillVersion.skill_id == skill_id)
            .order_by(desc(SkillVersion.version_number))
        )
        latest_version = result.scalars().first()
        next_version_num = (latest_version.version_number + 1) if latest_version else 1

        new_version = SkillVersion(
            id=uuid.uuid4(),
            skill_id=skill_id,
            version_number=next_version_num,
            status=SkillVersionStatus.processing,
            source_count=0
        )
        self.db.add(new_version)
        await self.db.commit()
        await self.db.refresh(new_version)
        return new_version

    async def get_version(self, version_id: uuid.UUID) -> Optional[SkillVersion]:
        result = await self.db.execute(select(SkillVersion).filter(SkillVersion.id == version_id))
        return result.scalars().first()

    async def list_versions(self, skill_id: uuid.UUID) -> List[SkillVersion]:
        result = await self.db.execute(
            select(SkillVersion)
            .filter(SkillVersion.skill_id == skill_id)
            .order_by(desc(SkillVersion.version_number))
        )
        return list(result.scalars().all())

    async def set_version_status(self, version_id: uuid.UUID, status: SkillVersionStatus, error_message: str = None) -> Optional[SkillVersion]:
        version = await self.get_version(version_id)
        if not version:
            return None
        
        version.status = status
        if error_message:
            version.error_message = error_message
        
        if status in [SkillVersionStatus.active, SkillVersionStatus.attention, SkillVersionStatus.error]:
            version.processed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(version)
        return version

    async def activate_version(self, skill_id: uuid.UUID, version_id: uuid.UUID) -> Optional[SkillVersion]:
        version = await self.get_version(version_id)
        if not version:
            return None
            
        skill_result = await self.db.execute(select(Skill).filter(Skill.id == skill_id))
        skill = skill_result.scalars().first()
        
        if not skill:
            return None

        # Activate the version and link it to the skill
        version.status = SkillVersionStatus.active
        version.activated_at = datetime.utcnow()
        skill.active_version_id = version.id
        skill.status = SkillStatus.active

        await self.db.commit()
        await self.db.refresh(version)
        await self.db.refresh(skill)
        return version
