import pytest
from httpx import AsyncClient, ASGITransport
from main import app, get_db
from unittest.mock import patch, MagicMock, AsyncMock
import json
from models import AgentConfigModel

class MockUsage:
    def __init__(self, prompt_tokens=10, completion_tokens=10):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.mini_prompt = 5
        self.mini_completion = 5
        self.main_prompt = 5
        self.main_completion = 5

@pytest.mark.asyncio
async def test_execute_chat_success():
    """Testa o endpoint /execute com sucesso simulado."""
    payload = {
        "agent_id": 1,
        "message": "Olá, como você está?",
        "history": [],
        "session_id": "test-session-123"
    }
    
    mock_agent = MagicMock()
    mock_agent.id = 1
    mock_agent.name = "Agente Teste"
    mock_agent.description = ""
    mock_agent.is_active = True
    mock_agent.tools = []
    mock_agent.knowledge_bases = []
    mock_agent.system_prompt = "Prompt"
    mock_agent.model = "gpt-4o-mini"
    mock_agent.fallback_model = ""
    mock_agent.temperature = 0.7
    mock_agent.top_p = 1.0
    mock_agent.top_k = 50
    mock_agent.presence_penalty = 0.0
    mock_agent.frequency_penalty = 0.0
    mock_agent.date_awareness = False
    mock_agent.context_window = 4000
    mock_agent.knowledge_base = "[]"
    mock_agent.knowledge_base_id = None
    mock_agent.rag_retrieval_count = 3
    mock_agent.simulated_time = ""
    mock_agent.security_competitor_blacklist = ""
    mock_agent.security_forbidden_topics = ""
    mock_agent.security_discount_policy = ""
    mock_agent.security_language_complexity = ""
    mock_agent.security_pii_filter = False
    mock_agent.security_bot_protection = False
    mock_agent.security_max_messages_per_session = 0
    mock_agent.security_semantic_threshold = 0.0
    mock_agent.security_loop_count = 0
    mock_agent.security_validator_ia = False
    mock_agent.ui_primary_color = ""
    mock_agent.ui_header_color = ""
    mock_agent.ui_chat_title = ""
    mock_agent.ui_welcome_message = ""
    mock_agent.router_enabled = False
    mock_agent.router_simple_model = ""
    mock_agent.router_simple_fallback_model = ""
    mock_agent.router_complex_model = ""
    mock_agent.router_complex_fallback_model = ""
    mock_agent.handoff_enabled = False
    mock_agent.response_translation_enabled = False
    mock_agent.response_translation_fallback_lang = "portuguese"
    mock_agent.safety_settings = ""
    mock_agent.model_settings = "{}"
    
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_agent
    mock_session.execute.return_value = mock_result
    
    app.dependency_overrides[get_db] = lambda: mock_session
    
    with patch("main.process_message", new_callable=AsyncMock) as mock_process, \
         patch("main.os.getenv", return_value="test-key"):
        
        mock_process.return_value = {
            "content": "Estou bem, obrigado!",
            "usage": MockUsage(prompt_tokens=10, completion_tokens=10),
            "error": False,
            "latency": 0.5,
            "model_used": "gpt-4o-mini",
            "handoff_data": {"handoff": False}
        }
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            headers = {"X-API-Key": "test-key"}
            response = await ac.post("/execute", json=payload, headers=headers)
    
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    data = response.json()
    # A resposta correta vem no campo 'response'
    assert "Estou bem" in data["response"]

@pytest.mark.asyncio
async def test_execute_chat_agent_not_found():
    """Testa o endpoint /execute quando o agente não existe."""
    payload = {
        "agent_id": 999,
        "message": "Oi",
        "history": []
    }
    
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_session.execute.return_value = mock_result
    
    app.dependency_overrides[get_db] = lambda: mock_session
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = {"X-API-Key": "test"}
        with patch("main.os.getenv", return_value="test"):
            response = await ac.post("/execute", json=payload, headers=headers)
    
    app.dependency_overrides.clear()
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
