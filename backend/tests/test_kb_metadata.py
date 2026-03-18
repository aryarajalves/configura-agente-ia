import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from smart_importer import generate_global_qa

@pytest.mark.asyncio
async def test_generate_global_qa_with_metadata():
    """Test that the global QA generation includes the metadado field."""
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content='[{"pergunta": "P1", "resposta": "R1", "categoria": "C1", "trecho_original": "T1", "pagina": 1, "metadado": "M1"}]'))
    ]
    mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=20)
    
    with patch("agent.get_openai_client") as mock_client_func:
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_client_func.return_value = mock_client
        
        with patch("config_store.MODEL_INFO", {"gpt-4o-mini": {"pricing": "test", "input": 0, "output": 0}}):
            qas, usage = await generate_global_qa("test text", total_questions=1)
            
            assert len(qas) == 1
            assert qas[0]["pergunta"] == "P1"
            assert qas[0]["metadado"] == "M1"

@pytest.mark.asyncio
async def test_router_import_metadado_mapping():
    """Test that the router correctly maps the 'metadado' from AI response to 'metadata_val'."""
    from router_import import preview_text_import
    from sqlalchemy.ext.asyncio import AsyncSession
    
    mock_db = MagicMock(spec=AsyncSession)
    mock_kb = MagicMock()
    mock_kb.question_label = "Q"
    mock_kb.answer_label = "A"
    mock_kb.metadata_label = "M"
    
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = mock_kb
    mock_db.execute.return_value = mock_res

    mock_qas = [{"pergunta": "P1", "resposta": "R1", "categoria": "C1", "trecho_original": "T1", "pagina": 1, "metadado": "M1"}]
    mock_usage = {"input_tokens": 10, "output_tokens": 10, "model": "m", "family": "f", "cost_usd": 0.0, "models": {"m"}}
    
    with patch("router_import.generate_global_qa", return_value=(mock_qas, mock_usage)):
        with patch("router_import.select"):
            with patch("router_import._log_extraction_cost", return_value=None):
                result = await preview_text_import(kb_id=1, text="some text", use_ai_qa=True, db=mock_db)
                
                assert result["preview"][0]["metadata_val"] == "M1"
