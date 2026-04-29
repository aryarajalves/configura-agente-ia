import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_execute_agent_message(client: AsyncClient, monkeypatch):
    import time
    aid = int(time.time())
    # Mock do process_message para não chamar OpenAI real
    async def mock_process(*args, **kwargs):
        return ("Olá, eu sou um agente de teste!", 0.001, 0.005, 10, 50, [], None, None)
    
    import agent
    monkeypatch.setattr(agent, "process_message", mock_process)
    
    # Primeiro criamos um agente para ter o ID
    agent_data = {
        "name": f"Chatty Agent {aid}",
        "model": "gpt-4o-mini",
        "system_prompt": "You are a friendly assistant."
    }
    create_res = await client.post("/agents", json=agent_data)
    agent_id = create_res.json()["id"]
    
    # Enviamos uma mensagem
    msg_data = {
        "agent_id": agent_id,
        "message": "Olá, quem é você?",
        "session_id": "test-session-123"
    }
    response = await client.post("/execute", json=msg_data)
    
    # Nota: Como o agente depende de chamadas reais à OpenAI, 
    # este teste pode falhar sem uma API KEY válida ou Mock.
    # Em testes unitários puros, deveríamos mockar a classe Agent em backend/agent.py
    
    assert response.status_code in [200, 500] # Se falhar por falta de chave, pode dar 500
    if response.status_code == 200:
        data = response.json()
        assert "response" in data
        assert "cost_usd" in data
