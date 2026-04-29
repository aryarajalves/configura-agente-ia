import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from agent import classify_message_complexity
from config_store import AgentConfig

@pytest.mark.asyncio
async def test_classify_message_complexity_simple():
    config = AgentConfig(id=1, name="Test")
    message = "Oi, tudo bem?"
    history = []
    
    # Mock OpenRouter/OpenAI client
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "SIMPLE"
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    
    with patch("agent.get_openai_client", return_value=mock_client):
        result = await classify_message_complexity(message, config, history)
        assert result == "SIMPLE"

@pytest.mark.asyncio
async def test_classify_message_complexity_complex_on_answer():
    config = AgentConfig(id=1, name="Test")
    message = "psicologo"
    history = [
        {"role": "user", "content": "Olá"},
        {"role": "assistant", "content": "Que ótimo! Você atua como terapeuta, coach, psicóloga ou em outra área?"}
    ]
    
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "COMPLEX"
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    
    with patch("agent.get_openai_client", return_value=mock_client):
        result = await classify_message_complexity(message, config, history)
        # O prompt agora inclui a última fala do agente e o critério de resposta curta
        assert result == "COMPLEX"
        
        # Verifica se o histórico foi usado no prompt
        args, kwargs = mock_client.chat.completions.create.call_args
        prompt = kwargs["messages"][0]["content"]
        assert "ÚLTIMA FALA DO AGENTE:" in prompt
        assert "Que ótimo!" in prompt
        assert "Respostas a perguntas feitas pelo agente" in prompt
