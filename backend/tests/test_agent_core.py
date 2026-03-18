import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json
from agent import (
    get_openai_client, 
    summarize_history, 
    extract_questions_from_history, 
    generate_handoff_summary,
    verify_output_safety,
    classify_message_complexity,
    validate_response_ai
)
from config_store import AgentConfig

@pytest.fixture
def mock_config():
    return AgentConfig(
        id=1,
        name="Test Agent",
        system_prompt="You are a test agent.",
        model="gpt-4o-mini",
        security_competitor_blacklist="CompetitorX, CompetitorY",
        security_forbidden_topics="TopicZ",
        security_pii_filter=True,
        router_enabled=True,
        router_simple_model="gpt-4o-mini",
        router_complex_model="gpt-4o"
    )

def test_get_openai_client(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    client = get_openai_client()
    assert client is not None
    
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    client = get_openai_client()
    assert client is None

@pytest.mark.asyncio
async def test_summarize_history():
    history = [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}]
    
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Summary text"))]
        mock_response.usage = {"total_tokens": 10}
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        result = await summarize_history(history)
        assert result["text"] == "Summary text"
        assert result["usage"] == {"total_tokens": 10}

@pytest.mark.asyncio
async def test_extract_questions_from_history():
    history = [{"role": "user", "content": "How are you?"}]
    
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="How are you?"))]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        result = await extract_questions_from_history(history)
        assert result["questions"] == ["How are you?"]

@pytest.mark.asyncio
async def test_generate_handoff_summary():
    history = [{"role": "user", "content": "I want to buy a car."}]
    
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="1. Name: N/A\n2. Product: Car"))]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        result = await generate_handoff_summary(history)
        assert "Product: Car" in result

def test_verify_output_safety(mock_config):
    # Test blacklist
    text = "We are better than CompetitorX."
    safe_text = verify_output_safety(text, mock_config)
    assert "[CONCORRENTE BLOQUEADO]" in safe_text
    
    # Test forbidden topics
    text = "Let's talk about TopicZ."
    safe_text = verify_output_safety(text, mock_config)
    assert "[TOPICO BLOQUEADO]" in safe_text
    
    # Test PII filter
    text = "My email is test@example.com and CPF is 123.456.789-00."
    safe_text = verify_output_safety(text, mock_config)
    assert "[EMAIL OCULTO]" in safe_text
    assert "[CPF OCULTO]" in safe_text

@pytest.mark.asyncio
async def test_classify_message_complexity(mock_config):
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Test SIMPLE
        mock_response_simple = MagicMock()
        mock_response_simple.choices = [MagicMock(message=MagicMock(content="SIMPLE"))]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response_simple)
        
        complexity = await classify_message_complexity("Oi", mock_config)
        assert complexity == "SIMPLE"
        
        # Test COMPLEX
        mock_response_complex = MagicMock()
        mock_response_complex.choices = [MagicMock(message=MagicMock(content="COMPLEX"))]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response_complex)
        
        complexity = await classify_message_complexity("Explique o Eneagrama", mock_config)
        assert complexity == "COMPLEX"

@pytest.mark.asyncio
async def test_validate_response_ai(mock_config):
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Test SAFE
        mock_response_safe = MagicMock()
        mock_response_safe.choices = [MagicMock(message=MagicMock(content="SAFE"))]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response_safe)
        
        result = await validate_response_ai("This is a safe response.", mock_config)
        assert result["is_safe"] is True
        
        # Test VIOLATION
        mock_response_violation = MagicMock()
        mock_response_violation.choices = [MagicMock(message=MagicMock(content="VIOLATION: Mentions competitor"))]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response_violation)
        
        result = await validate_response_ai("We are better than CompetitorX.", mock_config)
        assert result["is_safe"] is False
        assert "Mentions competitor" in result["reason"]


@pytest.mark.asyncio
async def test_fetch_user_memory():
    from agent import fetch_user_memory
    mock_db = AsyncMock()
    session_id = "test_session"
    
    # Mocking SQLAlchemy result
    mock_memory = MagicMock()
    mock_memory.key = "name"
    mock_memory.value = "John Doe"
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_memory]
    mock_db.execute.return_value = mock_result
    
    # We patch the models/sqlalchemy imports inside agent module
    # Since they are imported inside the function, we can't easily patch them with simple patch() 
    # unless we patch the entire models/sqlalchemy modules while the function runs.
    
    # Actually, if we just want to test the logic AFTER the db.execute:
    result = await fetch_user_memory(mock_db, session_id)
    assert "name: John Doe" in result

@pytest.mark.asyncio
async def test_update_user_memory():
    from agent import update_user_memory
    mock_db = AsyncMock()
    mock_db.add = MagicMock() # SQLAlchemy add is sync
    session_id = "test_session"
    message = "My name is Alice"
    response = "Nice to meet you Alice"
    
    with patch("agent.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Mock extracted facts
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({"name": "Alice"})))]
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        
        # Mock existing record check: select(...).where(...)
        # The function calls select(UserMemoryModel)
        # Instead of patching UserMemoryModel, let's patch sqlalchemy.select in the context of the agent function
        
        mock_stmt = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_db.execute.return_value = mock_result
        
        with patch("sqlalchemy.select") as mock_select:
            mock_select.return_value = mock_stmt
            mock_stmt.where.return_value = mock_stmt # Chained where calls
            
            await update_user_memory(mock_db, session_id, message, response)
            
            # Since UserMemoryModel is imported inside, we might still have issues 
            # if SQLAlchemy tries to inspect it. 
            # But if we mock select(), it returns our mock_stmt.
            
            # Check if add and commit were called
            assert mock_db.add.called
            assert mock_db.commit.called

