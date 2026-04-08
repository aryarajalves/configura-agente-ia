import pytest
from httpx import AsyncClient
from models import InteractionLog
from config_store import USD_TO_BRL

@pytest.mark.asyncio
async def test_get_sessions_history(client: AsyncClient, db_session):
    # Insere logs de sessão para teste
    from datetime import datetime
    from models import AgentConfigModel
    
    agent = AgentConfigModel(name="Test Agent", model="gpt-4o-mini")
    db_session.add(agent)
    await db_session.commit()
    await db_session.refresh(agent)
    
    log1 = InteractionLog(
        session_id="SESSION_TEST_1",
        agent_id=agent.id,
        user_message="Olá",
        agent_response="Oi!",
        model_used="gpt-4o-mini",
        input_tokens=10,
        output_tokens=10,
        cost_usd=0.01,
        cost_brl=0.01 * USD_TO_BRL,
        timestamp=datetime.utcnow()
    )
    db_session.add(log1)
    await db_session.commit()

    response = await client.get("/sessions")
    if response.status_code != 200:
        print(response.json())
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(s["session_id"] == "SESSION_TEST_1" for s in data)

@pytest.mark.asyncio
async def test_get_session_messages(client: AsyncClient, db_session):
    response = await client.get("/sessions/SESSION_TEST_1/messages")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2 # user and assistant message

@pytest.mark.asyncio
async def test_get_agent_history(client: AsyncClient, db_session):
    # Agent id 1 is default
    response = await client.get("/agents/1/history")
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)

@pytest.mark.asyncio
async def test_summarize_session(client: AsyncClient, db_session):
    response = await client.get("/sessions/SESSION_TEST_1/summarize")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data

@pytest.mark.asyncio
async def test_tester_provoke(client: AsyncClient, monkeypatch):
    # Mocking OpenAI
    class MockMessage:
        content = '{"provocation": "Test provocation", "sentiment": 60}'
    class MockChoice:
        message = MockMessage()
    class MockResponse:
        choices = [MockChoice()]
        class usage:
            prompt_tokens = 10
            completion_tokens = 10
            total_tokens = 20
    class MockCompletions:
        async def create(self, **kwargs):
            return MockResponse()
    class MockChat:
        completions = MockCompletions()
    class MockClient:
        chat = MockChat()

    import main
    monkeypatch.setattr(main, "get_openai_client", lambda *args: MockClient())

    payload = {
        "persona_prompt": "Test Persona",
        "history": [{"role": "user", "content": "hello"}],
        "is_dynamic": True
    }
    response = await client.post("/tester/provoke", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "provocation" in data
    assert "sentiment" in data

@pytest.mark.asyncio
async def test_tester_evaluate(client: AsyncClient, monkeypatch):
    # Mocking OpenAI
    class MockMessage:
        content = '{"score": 8, "strengths": [], "weaknesses": [], "recommendation": "Goo"}'
    class MockChoice:
        message = MockMessage()
    class MockResponse:
        choices = [MockChoice()]
        class usage:
            prompt_tokens = 10
            completion_tokens = 10
            total_tokens = 20
    class MockCompletions:
        async def create(self, **kwargs):
            return MockResponse()
    class MockChat:
        completions = MockCompletions()
    class MockClient:
        chat = MockChat()

    import main
    monkeypatch.setattr(main, "get_openai_client", lambda *args: MockClient())

    payload = {
        "persona_prompt": "Test Persona",
        "history": [{"role": "user", "content": "hello"}]
    }
    response = await client.post("/tester/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "score" in data

@pytest.mark.asyncio
async def test_tester_sentiment(client: AsyncClient, monkeypatch):
    # Mocking OpenAI
    class MockMessage:
        content = '{"sentiment": 75}'
    class MockChoice:
        message = MockMessage()
    class MockResponse:
        choices = [MockChoice()]
        class usage:
            prompt_tokens = 10
            completion_tokens = 10
            total_tokens = 20
    class MockCompletions:
        async def create(self, **kwargs):
            return MockResponse()
    class MockChat:
        completions = MockCompletions()
    class MockClient:
        chat = MockChat()

    import main
    monkeypatch.setattr(main, "get_openai_client", lambda *args: MockClient())

    payload = {
        "history": [{"role": "user", "content": "hello"}]
    }
    response = await client.post("/tester/sentiment", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "sentiment" in data
