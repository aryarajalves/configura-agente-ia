import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from agent import process_message
from config_store import AgentConfig

@pytest.fixture
def mock_config():
    return AgentConfig(
        id=1,
        name="Test Agent",
        system_prompt="You are a test agent.",
        model="gpt-4o-mini",
        router_enabled=False,
        date_awareness=False,
        handoff_enabled=False
    )

@pytest.mark.asyncio
async def test_process_message_basic(mock_config):
    message = "Hello"
    history = []
    
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Mocking the OpenAI response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Hi there!", tool_calls=None))]
        mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=5)
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        result = await process_message(message, history, mock_config)
        
        assert result["content"] == "Hi there!"
        assert result["usage"].prompt_tokens == 5
        assert result["error"] is False

@pytest.mark.asyncio
async def test_process_message_with_tools(mock_config):
    message = "What's the weather?"
    history = []
    
    # Define a tool
    mock_tool = MagicMock()
    mock_tool.name = "get_weather"
    mock_tool.description = "Get weather"
    mock_tool.parameters_schema = json.dumps({
        "type": "object",
        "properties": {"location": {"type": "string"}},
        "required": ["location"]
    })
    mock_tool.webhook_url = "http://weather.api/call"
    
    with patch("agent.get_openai_client") as mock_get_client, \
         patch("httpx.AsyncClient.post") as mock_post:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # 1. Turn 1: Model calls the tool
        mock_call = MagicMock()
        mock_call.id = "call_123"
        mock_call.function.name = "get_weather"
        mock_call.function.arguments = json.dumps({"location": "Recife"})
        
        mock_response_1 = MagicMock()
        mock_response_1.choices = [MagicMock(message=MagicMock(content=None, tool_calls=[mock_call]))]
        mock_response_1.usage = MagicMock(prompt_tokens=10, completion_tokens=5)
        
        # 2. Turn 2: Model responds after tool output
        mock_response_2 = MagicMock()
        mock_response_2.choices = [MagicMock(message=MagicMock(content="It's sunny in Recife", tool_calls=None))]
        mock_response_2.usage = MagicMock(prompt_tokens=20, completion_tokens=10)
        
        mock_client.chat.completions.create = AsyncMock(side_effect=[mock_response_1, mock_response_2])
        
        # Mock Webhook call
        mock_post.return_value = MagicMock(status_code=200, text="Sunny")
        
        result = await process_message(message, history, mock_config, tools=[mock_tool])
        
        assert "Recife" in result["content"]
        assert result["usage"].prompt_tokens == 30 # 10 + 20

@pytest.mark.asyncio
async def test_process_message_handoff(mock_config):
    mock_config.handoff_enabled = True
    message = "I want to talk to a human"
    
    with patch("agent.get_openai_client") as mock_get_client, \
         patch("agent.generate_handoff_summary") as mock_summary:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Model chooses to call transferir_atendimento
        mock_call = MagicMock()
        mock_call.id = "call_handoff"
        mock_call.function.name = "transferir_atendimento"
        mock_call.function.arguments = json.dumps({"destino": "humano", "motivo": "User requested"})
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=None, tool_calls=[mock_call]))]
        mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=5)
        
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_summary.return_value = "Summary: User wants human"
        
        result = await process_message(message, [], mock_config)
        
        assert "Transferindo para humano" in result["content"]
        assert result["handoff_data"]["handoff"] is True
        assert result["handoff_data"]["destino"] == "humano"

@pytest.mark.asyncio
async def test_process_message_error_handling(mock_config):
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Simulate API failure
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Down"))
        
        # No fallback configured
        result = await process_message("hi", [], mock_config)
        assert result["error"] is True
        assert "instabilidade" in result["content"] or "API Down" in result["content"]

@pytest.mark.asyncio
async def test_process_message_fallback(mock_config):
    mock_config.fallback_model = "gpt-4o-mini-fallback"
    
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Fail first call, succeed second call (fallback logic is handled by the model list in Turn loop)
        # Note: the current agent.py implementation tries models in a loop inside the TURN loop.
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Hi from fallback", tool_calls=None))]
        mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=5)
        
        # Side effect: First model fails, second (fallback) succeeds
        mock_client.chat.completions.create = AsyncMock(side_effect=[Exception("Main Model Failed"), mock_response])
        
        result = await process_message("hi", [], mock_config)
        assert result["content"] == "Hi from fallback"
        assert result["error"] is False
