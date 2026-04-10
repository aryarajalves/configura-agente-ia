import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.stress_test_service import StressTestService
from src.models.stress_test import StressTestStatus

@pytest.mark.asyncio
async def test_stress_test_lifecycle(db_session: AsyncSession):
    service = StressTestService(db_session)
    
    # 1. Create Persona
    persona = await service.create_persona(
        name="Test Persona",
        behavior_config={"tone": "aggressive"},
        description="Testing"
    )
    assert persona.id is not None
    
    # 2. Create Session
    user_id = uuid.uuid4()
    session = await service.create_session(uuid.UUID(persona.id), user_id)
    assert session.status == StressTestStatus.QUEUED
    assert session.persona_id == persona.id
    
    # 3. Update Status
    await service.update_session_status(uuid.UUID(session.id), StressTestStatus.PROCESSING, progress=50)
    updated_session = await service.get_session(uuid.UUID(session.id))
    assert updated_session.status == StressTestStatus.PROCESSING
    assert updated_session.progress_percentage == 50
    
    # 4. Success Completion
    await service.update_session_status(
        uuid.UUID(session.id), 
        StressTestStatus.SUCCESS, 
        progress=100, 
        relatorio_link="http://test.com/report.md"
    )
    final_session = await service.get_session(uuid.UUID(session.id))
    assert final_session.status == StressTestStatus.SUCCESS
    assert final_session.relatorio_md_link == "http://test.com/report.md"
    assert final_session.finished_at is not None
