import pytest
import io
import pandas as pd
import time
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from models import KnowledgeBaseModel, KnowledgeItemModel
from sqlalchemy import select

@pytest.mark.asyncio
async def test_analyze_kb_file_row_count(client: AsyncClient):
    # Create a dummy CSV
    df = pd.DataFrame({"pergunta": ["Q1", "Q2", "Q3"], "resposta": ["A1", "A2", "A3"]})
    csv_content = df.to_csv(index=False).encode("utf-8")
    
    files = {"file": ("test.csv", csv_content, "text/csv")}
    response = await client.post("/knowledge-bases/analyze-file", files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_rows"] == 3
    assert len(data["preview"]) <= 3

@pytest.mark.asyncio
async def test_import_mapped_fixed_metadata(client: AsyncClient, db_session):
    # 1. Setup KB
    ts = int(time.time()) + 200
    kb = KnowledgeBaseModel(name=f"Import Test {ts}", description="Testing fixed metadata")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)
    
    # 2. Create dummy CSV
    df = pd.DataFrame({"q": ["Questao 1"], "a": ["Resposta 1"], "meta_col": ["Old Meta"]})
    csv_content = df.to_csv(index=False).encode("utf-8")
    
    # 3. Mock embedding
    mock_emb = [0.1] * 1536
    with patch("main.get_embedding", new_callable=AsyncMock) as mock_get_emb:
        mock_get_emb.return_value = (mock_emb, {"tokens": 5})
        
        # 4. Import with fixed_metadata
        files = {"file": ("test.csv", csv_content, "text/csv")}
        data = {
            "question_col": "q",
            "answer_col": "a",
            "fixed_metadata": "FIXED_VALUE_123"
        }
        
        response = await client.post(f"/knowledge-bases/{kb.id}/import-mapped", files=files, data=data)
        assert response.status_code == 200
        
        # 5. Verify DB
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb.id)
        res = await db_session.execute(stmt)
        items = res.scalars().all()
        assert len(items) == 1
        assert items[0].metadata_val == "FIXED_VALUE_123"
