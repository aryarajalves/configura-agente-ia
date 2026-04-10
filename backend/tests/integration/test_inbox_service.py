import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.inbox_service import InboxService
from src.models.inbox import InboxItemStatus

@pytest.mark.asyncio
async def test_inbox_grouping_rapidfuzz(db_session: AsyncSession):
    service = InboxService(db_session)
    agent_id = uuid.uuid4()
    
    # 1. Create two very similar items
    item1 = await service.create_inbox_item(
        agent_id=agent_id,
        user_query="Como cancelar minha assinatura?",
        ai_response="Não sei.",
        failure_reason="Desconhecimento",
        context={}
    )
    
    item2 = await service.create_inbox_item(
        agent_id=agent_id,
        user_query="Gostaria de cancelar minha assinatura",
        ai_response="Erro.",
        failure_reason="Desconhecimento",
        context={}
    )
    
    # 2. Verify they belong to the same group
    # Refresh items to see changes from group_similar_failures
    await db_session.refresh(item1)
    await db_session.refresh(item2)
    
    # item1 was created first, and then group_similar_failures was called.
    # When item2 is created, group_similar_failures is called again.
    # item2 should match item1 and get its ID as group_id.
    assert item2.group_id == str(item1.id)
    
    # Verify frequency increment on the lead item
    assert item1.frequencia_erro == 2
    
    # 4. Create a different item
    item3 = await service.create_inbox_item(
        agent_id=agent_id,
        user_query="Qual o preço do plano premium?",
        ai_response="R$ 50.",
        failure_reason="Preço errado",
        context={}
    )
    # Refreshed in service, but let's be sure
    await db_session.refresh(item3)
    assert item3.group_id == str(item3.id) # Should be its own lead, as it doesn't match
