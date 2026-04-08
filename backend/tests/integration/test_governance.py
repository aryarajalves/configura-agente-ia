import pytest
import uuid
from sqlalchemy import select
from backend.src.services.inbox_service import InboxService
from backend.src.models.inbox import InboxItem, InboxItemStatus
from backend.src.models.skill import Skill, SkillVersion, SkillType, SkillStatus, VectorChunk

@pytest.mark.asyncio
async def test_discard_and_block_logic(db_session):
    service = InboxService(db_session)
    admin_id = uuid.uuid4()
    item_id = uuid.uuid4()
    
    # 1. Setup item
    item = InboxItem(
        id=str(item_id),
        agent_id=str(uuid.uuid4()),
        pergunta_usuario="Spam query",
        status=InboxItemStatus.PENDENTE
    )
    db_session.add(item)
    await db_session.commit()
    
    # 2. Test Discard
    await service.discard_item(item_id, admin_id)
    updated = await service.get_item(item_id)
    assert updated.status == InboxItemStatus.DESCARTADO
    
    # 3. Test Block
    await service.block_topic(item_id, admin_id)
    updated = await service.get_item(item_id)
    assert updated.status == InboxItemStatus.BLOQUEADO

@pytest.mark.asyncio
async def test_rag_versioned_correction(db_session):
    from backend.src.services.rag_service_v2 import RAGServiceV2
    from unittest.mock import patch, AsyncMock
    
    # 1. Setup Skill
    skill = Skill(
        id=uuid.uuid4(),
        name="Knowledge",
        type=SkillType.documental,
        status=SkillStatus.active
    )
    db_session.add(skill)
    await db_session.commit()
    
    service = RAGServiceV2(db_session)
    
    # Mock embedding since we don't want real API call
    with patch("backend.src.services.rag_service.RAGService.get_embedding", new_callable=AsyncMock) as mock_emb:
        mock_emb.return_value = [0.1] * 1536
        
        await service.apply_correction_to_rag(
            agent_id=uuid.uuid4(),
            user_query="How to reset password?",
            corrected_response="Go to settings > security."
        )
        
    # 2. Verify new version created
    await db_session.refresh(skill)
    assert skill.active_version_id is not None
    
    res = await db_session.execute(
        select(SkillVersion).where(SkillVersion.id == skill.active_version_id)
    )
    version = res.scalar_one()
    assert version.version_number == 1
    
    # 3. Verify chunk created
    chunk_res = await db_session.execute(
        select(VectorChunk).where(VectorChunk.skill_version_id == version.id)
    )
    chunk = chunk_res.scalar_one()
    assert "settings > security" in chunk.content
