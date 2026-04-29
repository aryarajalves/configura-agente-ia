import pytest
from httpx import AsyncClient
from sqlalchemy import select
from models import UnansweredQuestionModel, GlobalContextVariableModel, KnowledgeBaseModel, KnowledgeItemModel

@pytest.mark.asyncio
async def test_unanswered_questions_flow(client: AsyncClient, db_session):
    # 0. Create an agent
    from models import AgentConfigModel
    agent = AgentConfigModel(name="Test Agent", description="Test")
    db_session.add(agent)
    await db_session.commit()
    await db_session.refresh(agent)

    # 1. Create a mock unanswered question
    q = UnansweredQuestionModel(
        question="Qual o sentido da vida?",
        agent_id=agent.id,
        session_id="SESS_TEST",
        status="PENDENTE"
    )
    db_session.add(q)
    await db_session.commit()
    await db_session.refresh(q)

    # 2. List unanswered
    response = await client.get("/unanswered-questions")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["items"]) >= 1
    assert any(item["id"] == q.id for item in data["items"])

    # 3. Create a Knowledge Base for answering
    kb = KnowledgeBaseModel(name="FAQ", description="FAQ Base")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)

    # 4. Answer the question
    payload = {
        "answer": "42",
        "knowledge_base_id": kb.id
    }
    response = await client.post(f"/unanswered-questions/{q.id}/answer", json=payload)
    assert response.status_code == 200
    assert response.json()["message"]

    # 5. Verify status and knowledge item
    await db_session.refresh(q)
    assert q.status == "RESPONDIDA"
    
    stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb.id)
    res = await db_session.execute(stmt)
    kb_item = res.scalars().first()
    assert kb_item is not None
    assert kb_item.answer == "42"

    # 6. Discard another question
    q2 = UnansweredQuestionModel(
        question="Ignore me",
        status="PENDENTE"
    )
    db_session.add(q2)
    await db_session.commit()
    await db_session.refresh(q2)
    
    response = await client.post(f"/unanswered-questions/{q2.id}/discard")
    assert response.status_code == 200
    await db_session.refresh(q2)
    assert q2.status == "DESCARTADA"

@pytest.mark.asyncio
async def test_global_context_variables_crud(client: AsyncClient, db_session):
    # 1. Create
    payload = {
        "key": "TEST_VAR",
        "value": "Hello",
        "description": "A test variable"
    }
    response = await client.post("/global-variables", json=payload)
    assert response.status_code == 200
    var_id = response.json()["id"]

    # 2. List
    response = await client.get("/global-variables")
    assert response.status_code == 200
    data = response.json()
    assert any(v["key"] == "TEST_VAR" for v in data)

    # 3. Update
    payload = {
        "key": "TEST_VAR_UPDATED",
        "value": "World",
        "description": "Updated description"
    }
    response = await client.put(f"/global-variables/{var_id}", json=payload)
    assert response.status_code == 200
    assert response.json()["value"] == "World"

    # 4. Delete
    response = await client.delete(f"/global-variables/{var_id}")
    assert response.status_code == 200
    
    # Verify deletion
    stmt = select(GlobalContextVariableModel).where(GlobalContextVariableModel.id == var_id)
    res = await db_session.execute(stmt)
    assert res.scalars().first() is None
