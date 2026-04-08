import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from unittest.mock import patch
import os

@pytest.mark.asyncio
async def test_list_models_connection_status():
    """Testa se o endpoint /models retorna o status de conexão das APIs corretamente."""
    
    # Mock do discover_models para retornar uma lista vazia ou fixa
    with patch("config_store.discover_models", return_value=[]):
        # Caso 1: Ambos conectados
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test", "GEMINI_API_KEY": "ai-test"}):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                headers = {"X-API-Key": os.getenv("AGENT_API_KEY", "a0c10372-af47-4a36-932a-9b1acdb59366")}
                response = await ac.get("/models", headers=headers)
                
            assert response.status_code == 200
            data = response.json()
            assert data["openai_connected"] is True
            assert data["gemini_connected"] is True

        # Caso 2: Apenas OpenAI conectado
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
            # Precisamos remover o Gemini do environ se ele estiver lá
            if "GEMINI_API_KEY" in os.environ:
                del os.environ["GEMINI_API_KEY"]
                
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                headers = {"X-API-Key": os.getenv("AGENT_API_KEY", "a0c10372-af47-4a36-932a-9b1acdb59366")}
                response = await ac.get("/models", headers=headers)
                
            assert response.status_code == 200
            data = response.json()
            assert data["openai_connected"] is True
            assert data["gemini_connected"] is False

        # Caso 3: Nenhum conectado
        with patch.dict(os.environ, {}):
            if "OPENAI_API_KEY" in os.environ: del os.environ["OPENAI_API_KEY"]
            if "GEMINI_API_KEY" in os.environ: del os.environ["GEMINI_API_KEY"]
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                headers = {"X-API-Key": os.getenv("AGENT_API_KEY", "a0c10372-af47-4a36-932a-9b1acdb59366")}
                response = await ac.get("/models", headers=headers)
                
            assert response.status_code == 200
            data = response.json()
            assert data["openai_connected"] is False
            assert data["gemini_connected"] is False
