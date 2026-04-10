import pytest
from httpx import AsyncClient
from src.models.admin import AdminRole, Admin
from src.models.agent import Agent, AgentStatus
from src.models.audit import AuditLog
from src.api.auth import create_access_token
from sqlalchemy import select
import uuid

@pytest.fixture
async def users(db_session):
    # Create SUPERADMIN (Owner)
    uid = uuid.uuid4().hex[:6]
    owner = Admin(
        id=uuid.uuid4(),
        email=f"owner_{uid}@fluxai.com",
        password_hash="hash",
        role=AdminRole.SUPERADMIN
    )
    # Create regular ADMIN
    assistant = Admin(
        id=uuid.uuid4(),
        email=f"assistant_{uid}@fluxai.com",
        password_hash="hash",
        role=AdminRole.SUPERADMIN
    )
    db_session.add_all([owner, assistant])
    await db_session.commit()
    
    owner_token = create_access_token(data={"sub": str(owner.id), "role": owner.role.value})
    assistant_token = create_access_token(data={"sub": str(assistant.id), "role": assistant.role.value})
    
    return {
        "owner": owner,
        "owner_token": owner_token,
        "assistant": assistant,
        "assistant_token": assistant_token
    }

@pytest.fixture
async def locked_agent(db_session, users):
    agent = Agent(
        id=uuid.uuid4(),
        name="Locked Secret Agent",
        superadmin_id=users["owner"].id,
        is_locked=True,
        model_fast_id="gpt-4o-mini",
        model_analytic_id="gpt-4o",
        status=AgentStatus.ACTIVE
    )
    db_session.add(agent)
    await db_session.commit()
    return agent

@pytest.mark.asyncio
async def test_agent_edit_lock_denial(client: AsyncClient, users, locked_agent):
    """
    US2 / FR-005: Deny edit access for regular Admin on a locked agent.
    """
    payload = {"name": "Hacked Name"}
    headers = {"Authorization": f"Bearer {users['assistant_token']}"}
    
    response = await client.put(f"/v1/agents/{locked_agent.id}", json=payload, headers=headers)
    
    # This should fail with 403 Forbidden
    assert response.status_code == 403
    assert "locked" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_agent_edit_lock_allow_owner(client: AsyncClient, users, locked_agent):
    """
    US2 / FR-006: Allow SUPERADMIN (Owner) to edit even if locked.
    """
    payload = {"name": "New Official Name"}
    headers = {"Authorization": f"Bearer {users['owner_token']}"}
    
    response = await client.put(f"/v1/agents/{locked_agent.id}", json=payload, headers=headers)
    
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "New Official Name"

@pytest.mark.asyncio
async def test_audit_log_registration(client: AsyncClient, db_session, users, locked_agent):
    """
    FR-010: Ensure successful edits generate an audit record.
    """
    payload = {"name": "Audited Name Change"}
    headers = {"Authorization": f"Bearer {users['owner_token']}"}
    
    # Act
    await client.put(f"/v1/agents/{locked_agent.id}", json=payload, headers=headers)
    
    # Assert
    result = await db_session.execute(select(AuditLog).where(AuditLog.agent_id == locked_agent.id))
    log = result.scalars().first()
    
    assert log is not None
    assert log.action == "UPDATE_AGENT"
    assert log.new_state["name"] == "Audited Name Change"
    assert log.superadmin_id == users["owner"].id
