import pytest
import time
from httpx import AsyncClient

@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    # Mock do get_embedding para evitar chamadas OpenAI e erro de dimensões
    async def mock_get_emb(text):
        class MockUsage:
            def __init__(self):
                self.total_tokens = 10
                self.prompt_tokens = 5
                self.completion_tokens = 5
        # Retorna 1536 zeros (Conforme definido em models.py)
        return [0.0] * 1536, MockUsage()
    
    import rag_service
    import main
    monkeypatch.setattr(rag_service, "get_embedding", mock_get_emb)
    monkeypatch.setattr(main, "get_embedding", mock_get_emb)

@pytest.mark.asyncio
async def test_batch_update_knowledge_items(client: AsyncClient):
    kbid = int(time.time() + 500)
    # 1. Criar KB
    kb_res = await client.post("/knowledge-bases", json={"name": f"Batch Update Test {kbid}", "description": "Test"})
    kb_id = kb_res.json()["id"]
    
    # 2. Adicionar 2 itens
    res1 = await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "Q1", "answer": "A1", "category": "Old"})
    res2 = await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "Q2", "answer": "A2", "category": "Old"})
    
    item1_id = res1.json()["id"]
    item2_id = res2.json()["id"]
    ids = [item1_id, item2_id]
    
    # 3. Atualizar em massa (Categoria e Metadado)
    update_data = {
        "item_ids": ids,
        "category": "Updated Category",
        "metadata_val": "New Metadata"
    }
    response = await client.put(f"/knowledge-bases/{kb_id}/items/batch-update", json=update_data)
    assert response.status_code == 200
    assert "Updated 2 items" in response.json()["message"]
    
    # 4. Verificar se atualizou
    kb_res_after = await client.get(f"/knowledge-bases/{kb_id}")
    items_after = kb_res_after.json()["items"]
    
    updated_items = [i for i in items_after if i["id"] in ids]
    assert len(updated_items) == 2
    for item in updated_items:
        assert item["category"] == "Updated Category"
        assert item["metadata_val"] == "New Metadata"
        # Pergunta deve continuar a mesma
        assert item["question"] in ["Q1", "Q2"]

@pytest.mark.asyncio
async def test_batch_update_single_field(client: AsyncClient):
    kbid = int(time.time() + 550)
    kb_res = await client.post("/knowledge-bases", json={"name": f"Batch Single Field {kbid}", "description": "Test"})
    kb_id = kb_res.json()["id"]
    
    res = await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "Q", "answer": "A", "category": "Cat"})
    item_id = res.json()["id"]
    
    # Update only answer
    response = await client.put(f"/knowledge-bases/{kb_id}/items/batch-update", json={
        "item_ids": [item_id],
        "answer": "Only answer updated"
    })
    assert response.status_code == 200
    
    kb_res_after = await client.get(f"/knowledge-bases/{kb_id}")
    item_after = [i for i in kb_res_after.json()["items"] if i["id"] == item_id][0]
    assert item_after["answer"] == "Only answer updated"
    assert item_after["question"] == "Q"
    assert item_after["category"] == "Cat"

@pytest.mark.asyncio
async def test_bulk_summarize_items(client: AsyncClient):
    kbid = int(time.time() + 600)
    # 1. Criar KB
    kb_res = await client.post("/knowledge-bases", json={"name": f"Summarize Test {kbid}", "description": "Test"})
    kb_id = kb_res.json()["id"]
    
    # 2. Adicionar 2 itens para resumir
    await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "Aula 1", "answer": "Conteúdo da aula 1 sobre Neurociências.", "category": "Aulas"})
    await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "Aula 2", "answer": "Conteúdo da aula 2 sobre Prática Clínica.", "category": "Aulas"})
    
    kb_data = await client.get(f"/knowledge-bases/{kb_id}")
    item_ids = [i["id"] for i in kb_data.json()["items"]]
    
    # 3. Chamar resumo em massa
    summarize_data = {
        "item_ids": item_ids,
        "question": "Resumo do Módulo",
        "metadata_val": "Módulo 1 | Completo",
        "category": "Resumo"
    }
    response = await client.post(f"/knowledge-bases/{kb_id}/items/bulk-summarize", json=summarize_data)
    assert response.status_code == 200
    assert "Resumo gerado e salvo com sucesso!" in response.json()["message"]
    
    # 4. Verificar se o novo item existe
    kb_final = await client.get(f"/knowledge-bases/{kb_id}")
    items = kb_final.json()["items"]
    new_item = [i for i in items if i["question"] == "Resumo do Módulo"][0]
    
    assert new_item["metadata_val"] == "Módulo 1 | Completo"
    assert new_item["category"] == "Resumo"
    assert len(new_item["answer"]) > 0 # Resumo foi gerado

@pytest.mark.asyncio
async def test_batch_update_non_existent_kb_items(client: AsyncClient):
    # Usar um kb_id que provavelmente não existe ou não tem esses itens
    response = await client.put("/knowledge-bases/999999/items/batch-update", json={
        "item_ids": [1, 2, 3],
        "category": "None"
    })
    assert response.status_code == 404
