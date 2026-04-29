import pytest
import uuid
import json
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from models import KnowledgeBaseModel, KnowledgeItemModel

@pytest.mark.asyncio
async def test_preview_text_import(client: AsyncClient):
    # Mocking extraction and generation
    with patch("router_import.generate_global_qa", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = (
            [{"pergunta": "Q1", "resposta": "A1", "categoria": "C1"}],
            {"input_tokens": 10, "output_tokens": 5, "model": "gpt-4o-mini"}
        )
        
        response = await client.post(
            "/knowledge-bases/1/preview-text-import",
            data={
                "text": "O sol brilha.",
                "use_ai_qa": "true",
                "global_qa_count": "1"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "preview" in data
        assert len(data["preview"]) == 1
        assert data["preview"][0]["question"] == "Q1"
        assert "usage" in data

@pytest.mark.asyncio
async def test_batch_import_items(client: AsyncClient, db_session):
    # 1. Setup KB
    kb_name = f"Test KB {uuid.uuid4()}"
    kb = KnowledgeBaseModel(name=kb_name, description="Test Description")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)
    
    # 2. Mock embedding
    mock_emb = [0.1] * 1536
    with patch("router_import.get_embedding", new_callable=AsyncMock) as mock_get_emb:
        mock_get_emb.return_value = (mock_emb, {"tokens": 5})
        
        payload = {
            "items": [
                {
                    "question": "O que é IA?",
                    "answer": "Inteligência Artificial.",
                    "category": "Tech"
                },
                {
                    "question": "2+2?",
                    "answer": "4",
                    "category": "Math"
                }
            ]
        }
        
        response = await client.post(
            f"/knowledge-bases/{kb.id}/batch-import",
            json=payload
        )
        assert response.status_code == 200
        assert "processados" in response.json()["message"]
        
        # 3. Verify DB
        from sqlalchemy import select
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb.id)
        res = await db_session.execute(stmt)
        items = res.scalars().all()
        assert len(items) == 2
        assert any(it.question == "O que é IA?" for it in items)

@pytest.mark.asyncio
async def test_preview_url_import(client: AsyncClient):
    with patch("router_import.extract_text_from_url", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = "Conteúdo simulado do site."
        with patch("router_import.generate_global_qa", new_callable=AsyncMock) as mock_gen:
             mock_gen.return_value = (
                [{"pergunta": "WebQ", "resposta": "WebA", "categoria": "Web"}],
                {"input_tokens": 5, "output_tokens": 3, "model": "gpt-4o-mini"}
            )
             
             response = await client.post(
                 "/knowledge-bases/1/preview-url-import",
                 data={
                     "url": "https://example.com",
                     "use_ai_qa": "true"
                 }
             )
             assert response.status_code == 200
             data = response.json()
             assert len(data["preview"]) > 0
             assert data["preview"][0]["question"] == "WebQ"

@pytest.mark.asyncio
async def test_preview_structured_json_import(client: AsyncClient):
    structured_json = [
        {
            "context": [
                {
                    "metadata_val": "Test Metadata",
                    "context": "Test Content"
                }
            ]
        }
    ]
    
    response = await client.post(
        "/knowledge-bases/1/preview-text-import",
        data={
            "text": json.dumps(structured_json),
            "use_ai_qa": "true"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "preview" in data
    assert len(data["preview"]) == 1
    assert data["preview"][0]["question"] == "Test Metadata"
    assert data["preview"][0]["answer"] == "Test Content"
    assert data.get("is_structured_json") is True
