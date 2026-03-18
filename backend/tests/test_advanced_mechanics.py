import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

import os
import sys

# Garante que as importações a partir do diretório raiz/backend funcionem
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from agent import process_message, get_openai_client
from config_store import AgentConfig

@pytest.fixture
def advanced_config():
    return AgentConfig(
        id=99,
        name="Teste Avançado",
        model="gpt-4o",
        fallback_model="gpt-4o-mini",
        temperature=0.7,
        top_p=0.9,
        top_k=40,
        presence_penalty=0.1,
        frequency_penalty=0.2,
        router_enabled=False,
        model_settings={
            "main": {
                "temperature": 0.5,
                "presence_penalty": 0.8
            },
            "main_fallback": {
                "temperature": 0.2
            }
        }
    )

@pytest.mark.asyncio
async def test_process_message_returns_correct_model(advanced_config):
    """
    Testa se o retorno FINAL de `process_message` inclui o nome
    do modelo exato que gerou a resposta e as métricas.
    """
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Resposta oficial", tool_calls=None))]
        mock_response.usage = MagicMock(prompt_tokens=15, completion_tokens=10)
        
        # O mock da chamada principal da API
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        result = await process_message(
            message="Teste de modelo",
            history=[],
            config=advanced_config,
            context_variables={}
        )
        
        # O modelo utilizado foi o principal (gpt-4o)
        assert result["content"] == "Resposta oficial"
        assert result["model"] == "gpt-4o"

@pytest.mark.asyncio
async def test_process_message_fallback_trigger():
    """
    Testa se o agente tenta e engatilha o modelo de fallback caso o primeiro falhe,
    garantindo que o modelo exato do fallback será retornado.
    """
    config = AgentConfig(
        id=100,
        name="Fallback Agent",
        model="gemini-3.1-pro-preview",
        fallback_model="gpt-5.2",
        router_enabled=False
    )
    
    with patch("agent.get_openai_client") as mock_get_client:
        
        def mock_create_effect(**kwargs):
            model = kwargs.get("model", "")
            if "gemini" in model:
                # Força erro na primeira tentativa
                raise Exception("API Key Inválida ou Limite de Uso")
            else:
                # Sucesso no Fallback
                mock_response = MagicMock()
                mock_response.choices = [MagicMock(message=MagicMock(content="Sou o fallback", tool_calls=None))]
                mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=5)
                return mock_response
        
        # Precisamos interceptar o método create de acordo com o modelo do client falso
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=mock_create_effect)
        mock_get_client.return_value = mock_client
        
        result = await process_message(
            message="Teste de fallback",
            history=[],
            config=config,
            context_variables={}
        )
        
        assert result["content"] == "Sou o fallback"
        assert result["model"] == "gpt-5.2" # Confirma que é o fallback que de fato rodou

@pytest.mark.asyncio
async def test_process_message_applies_role_settings(advanced_config):
    """
    Testa se o agente extrai corretamente os parâmetros globais e por role
    (temperatura, penalidades) do json `model_settings` e aplica na chamada OpenAI.
    """
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Resposta com parametros", tool_calls=None))]
        mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=5)
        
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        await process_message(
            message="Teste de parametros",
            history=[],
            config=advanced_config,
            context_variables={}
        )
        
        # Pega as kwargs passadas para o mock client
        create_kwargs = mock_client.chat.completions.create.call_args.kwargs
        
        # Verifica se as definições da role "main" substituíram os valores padrão
        assert create_kwargs["temperature"] == 0.5
        assert create_kwargs["presence_penalty"] == 0.8
        
        # Verifica se usou o "config global do agente" para os que não estavam na role
        assert create_kwargs["top_p"] == 0.9
        assert create_kwargs["frequency_penalty"] == 0.2

def test_gemini_client_configuration(monkeypatch):
    """
    Verifica se o client obtido para 'gemini' usa as URLs de compatibilidade OpenAI certas.
    """
    monkeypatch.setenv("GEMINI_API_KEY", "chave_google_teste")
    client = get_openai_client("gemini-1.5-flash")
    
    assert client is not None
    assert str(client.base_url) == "https://generativelanguage.googleapis.com/v1beta/openai/"
    # A verificação da chave não é exposta trivialmente no objeto AsyncOpenAI, 
    # Mas se instanciou com a base_url correta, indica sucesso no desvio.
    
    monkeypatch.setenv("OPENAI_API_KEY", "chave_openai_teste")
    client2 = get_openai_client("gpt-4o")
    
    assert str(client2.base_url) == "https://api.openai.com/v1/"
