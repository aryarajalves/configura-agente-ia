import pytest
import uuid
from httpx import AsyncClient
from src.main import app
from src.api.auth import create_access_token
from src.models.admin import AdminRole
from src.models.inbox import InboxItem, InboxItemStatus
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_list_inbox_items(client: AsyncClient, db_session: AsyncSession):
    # 1. Setup Admin Token
    admin_id = str(uuid.uuid4())
    token = create_access_token({"sub": admin_id, "role": AdminRole.ADMIN})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Add sample items
    agent_id = str(uuid.uuid4())
    item1 = InboxItem(
        agent_id=agent_id,
        pergunta_usuario="Teste 1",
        status=InboxItemStatus.PENDENTE
    )
    db_session.add(item1)
    await db_session.commit()
    
    # 3. Request API
    response = await client.get("/v1/inbox/", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) >= 1
    assert data["data"][0]["pergunta_usuario"] == "Teste 1"

@pytest.mark.asyncio
async def test_resolve_inbox_item(client: AsyncClient, db_session: AsyncSession):
    admin_id = str(uuid.uuid4())
    token = create_access_token({"sub": admin_id, "role": AdminRole.ADMIN})
    headers = {"Authorization": f"Bearer {token}"}
    
    item = InboxItem(
        agent_id=str(uuid.uuid4()),
        pergunta_usuario="Teste resolve",
        status=InboxItemStatus.PENDENTE
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    
    response = await client.post(
        f"/v1/inbox/{item.id}/resolve", 
        json={"final_response": "Fixed!"},
        headers=headers
    )
    
    assert response.status_code == 200
    
    # Check DB
    await db_session.refresh(item)
    assert item.status == InboxItemStatus.RESOLVIDO
    assert item.resposta_final_usuario == "Fixed!"
