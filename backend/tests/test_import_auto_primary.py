import pytest
import io
import pandas as pd
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from models import KnowledgeBaseModel, KnowledgeItemModel
from sqlalchemy import select
import json
import time

@pytest.mark.asyncio
async def test_import_products_auto_primary_col(client: AsyncClient, db_session):
    # 1. Setup KB
    ts = int(time.time())
    kb = KnowledgeBaseModel(name=f"Product Auto Primary Test {ts}", description="Testing auto primary detection", kb_type="product")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)
    
    # 2. Create dummy CSV (without a dedicated primary column selection in the mapping, 
    # but the backend should pick the first mapped column if primary_col is None)
    df = pd.DataFrame({
        "Codigo": ["P123", "P456"], 
        "Nome": ["Produto A", "Produto B"], 
        "Preco": ["10.00", "20.00"]
    })
    csv_content = df.to_csv(index=False).encode("utf-8")
    
    # 3. Mock embedding
    mock_emb = [0.1] * 1536
    with patch("main.get_embedding", new_callable=AsyncMock) as mock_get_emb:
        mock_get_emb.return_value = (mock_emb, {"tokens": 5})
        
        # 4. Import without primary_col explicitly provided
        files = {"file": ("products.csv", csv_content, "text/csv")}
        mapping = [
            {"column": "Codigo", "label": "SKU: "},
            {"column": "Nome", "label": "Nome: "},
            {"column": "Preco", "label": "Preço: "}
        ]
        data = {
            "mapping_json": json.dumps(mapping)
            # primary_col is NOT sent
        }
        
        response = await client.post(f"/knowledge-bases/{kb.id}/import-products", files=files, data=data)
        assert response.status_code == 200
        assert "2 produtos adicionados" in response.json()["message"]
        
        # 5. Verify DB - Check if source_metadata contains the correct primary_key from the first column
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb.id)
        res = await db_session.execute(stmt)
        items = res.scalars().all()
        assert len(items) == 2
        
        item_p123 = [i for i in items if "P123" in i.answer][0]
        meta = json.loads(item_p123.source_metadata)
        assert meta["primary_key"] == "P123" # Successfully auto-detected Codigo as primary_col

@pytest.mark.asyncio
async def test_import_products_text_auto_primary(client: AsyncClient, db_session):
    # 1. Setup KB
    ts = int(time.time()) + 1
    kb = KnowledgeBaseModel(name=f"Product Text Auto Primary {ts}", description="Testing auto primary on text", kb_type="product")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)
    
    # 2. Text CSV formatted string
    csv_text = "ID,Desc\n1,Prato\n2,Copo"
    
    # 3. Mock embedding
    mock_emb = [0.1] * 1536
    with patch("main.get_embedding", new_callable=AsyncMock) as mock_get_emb:
        mock_get_emb.return_value = (mock_emb, {"tokens": 5})
        
        # 4. Import without primary_col
        mapping = [{"column": "ID", "label": "Identificador: "}, {"column": "Desc", "label": "Item: "}]
        data = {
            "mapping_json": json.dumps(mapping),
            "text": csv_text
        }
        
        response = await client.post(f"/knowledge-bases/{kb.id}/import-products-text", data=data)
        assert response.status_code == 200
        
        # 5. Verify DB
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb.id)
        res = await db_session.execute(stmt)
        items = res.scalars().all()
        assert len(items) == 2
        
        meta = json.loads(items[0].source_metadata)
        assert "primary_key" in meta
        assert meta["primary_key"] in ["1", "2"]
