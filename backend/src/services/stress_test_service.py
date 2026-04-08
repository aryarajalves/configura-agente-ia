import uuid
import logging
import asyncio
from typing import List, Optional, Any, Dict
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from backend.src.models.stress_test import StressTestPersona, StressTestSession, StressTestStatus
from backend.src.models.inbox import BackgroundTask, BackgroundTaskType, BackgroundTaskStatus

logger = logging.getLogger(__name__)

class StressTestService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_persona(self, name: str, behavior_config: Dict[str, Any], description: Optional[str] = None) -> StressTestPersona:
        persona = StressTestPersona(
            name=name,
            description=description,
            behavior_config=behavior_config
        )
        self.db.add(persona)
        await self.db.commit()
        await self.db.refresh(persona)
        return persona

    async def get_persona(self, persona_id: uuid.UUID) -> Optional[StressTestPersona]:
        result = await self.db.execute(select(StressTestPersona).where(StressTestPersona.id == str(persona_id)))
        return result.scalar_one_or_none()

    async def list_personas(self) -> List[StressTestPersona]:
        result = await self.db.execute(select(StressTestPersona))
        return result.scalars().all()

    async def create_session(self, persona_id: uuid.UUID, created_by: uuid.UUID) -> StressTestSession:
        persona = await self.get_persona(persona_id)
        if not persona:
            raise ValueError("Persona not found")

        session = StressTestSession(
            persona_id=str(persona_id),
            persona_snapshot=persona.behavior_config,
            status=StressTestStatus.QUEUED,
            created_by=str(created_by),
            started_at=datetime.utcnow()
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def submit_stress_test_task(self, session_id: uuid.UUID):
        from backend.src.workers.stress_test import run_stress_test_session
        persona = await self.db.execute(
            select(StressTestPersona)
            .join(StressTestSession)
            .where(StressTestSession.id == str(session_id))
        )
        persona_obj = persona.scalar_one()
        
        await self.update_session_status(session_id, StressTestStatus.PROCESSING, progress=0)
        await run_stress_test_session.kiq(str(session_id), persona_obj.behavior_config)

    async def update_session_status(
        self, 
        session_id: uuid.UUID, 
        status: StressTestStatus, 
        progress: int = None,
        error_message: str = None,
        relatorio_link: str = None
    ):
        values = {"status": status, "updated_at": datetime.utcnow()}
        if progress is not None:
            values["progress_percentage"] = progress
        if error_message is not None:
            values["error_message"] = error_message
        if relatorio_link is not None:
            values["relatorio_md_link"] = relatorio_link
        if status in [StressTestStatus.SUCCESS, StressTestStatus.ERROR, StressTestStatus.TIMEOUT]:
            values["finished_at"] = datetime.utcnow()

        await self.db.execute(
            update(StressTestSession)
            .where(StressTestSession.id == str(session_id))
            .values(**values)
        )
        await self.db.commit()

    async def get_session(self, session_id: uuid.UUID) -> Optional[StressTestSession]:
        result = await self.db.execute(select(StressTestSession).where(StressTestSession.id == str(session_id)))
        return result.scalar_one_or_none()
