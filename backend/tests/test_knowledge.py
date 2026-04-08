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
async def test_create_knowledge_base(client: AsyncClient):
    kbid = int(time.time() + 90)
    kb_data = {
        "name": f"Test KB {kbid}",
        "description": "A knowledge base for testing."
    }
    response = await client.post("/knowledge-bases", json=kb_data)
    assert response.status_code == 200
    assert response.json()["name"] == f"Test KB {kbid}"

@pytest.mark.asyncio
async def test_add_knowledge_item(client: AsyncClient):
    kbid = int(time.time() + 100)
    # Criar KB
    kb_res = await client.post("/knowledge-bases", json={"name": f"KB for items {kbid}"})
    kb_id = kb_res.json()["id"]
    
    item_data = {
        "question": "What is unit testing?",
        "answer": "Testing small parts of code.",
        "category": "Education"
    }
    response = await client.post(f"/knowledge-bases/{kb_id}/items", json=item_data)
    assert response.status_code == 200
    assert response.json()["question"] == "What is unit testing?"

@pytest.mark.asyncio
async def test_batch_import_knowledge_items(client: AsyncClient):
    kbid = int(time.time() + 110)
    # Criar KB
    kb_res = await client.post("/knowledge-bases", json={"name": f"KB for batch {kbid}"})
    kb_id = kb_res.json()["id"]
    
    batch_data = {
        "items": [
            {"question": "Q1", "answer": "A1", "category": "Test"},
            {"question": "Q2", "answer": "A2", "category": "Test"}
        ]
    }
    response = await client.post(f"/knowledge-bases/{kb_id}/items/bulk", json=batch_data["items"])
    assert response.status_code == 200
    assert "concluded" in response.json()["message"].lower() or "synced" in response.json()["message"].lower()

@pytest.mark.asyncio
async def test_list_knowledge_bases(client: AsyncClient):
    response = await client.get("/knowledge-bases")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_find_knowledge_duplicates(client: AsyncClient):
    kbid = int(time.time() + 200)
    # 1. Criar KB
    kb_res = await client.post("/knowledge-bases", json={"name": f"KB Duplicates Test {kbid}"})
    kb_id = kb_res.json()["id"]
    
    # 2. Inserir itens (incluindo duplicatas)
    # Item 1 e 2 são duplicados (mesmo q/a)
    # Item 3 é diferente
    items = [
        {"question": "What is AI?", "answer": "Artificial Intelligence", "category": "Tech"},
        {"question": "what is ai? ", "answer": " Artificial Intelligence", "category": "Tech"}, # Variação de case/espaço
        {"question": "How to train?", "answer": "With data.", "category": "Tech"}
    ]
    
    for item in items:
        await client.post(f"/knowledge-bases/{kb_id}/items", json=item)
        
    # 3. Chamar endpoint de duplicados
    response = await client.get(f"/knowledge-bases/{kb_id}/duplicates")
    assert response.status_code == 200
    data = response.json()
    
    assert "duplicates" in data
    # Deve encontrar 1 grupo de duplicados (as 2 variações de 'What is AI?')
    assert len(data["duplicates"]) == 1
    assert data["duplicates"][0]["count"] == 2
    assert len(data["duplicates"][0]["ids"]) == 2

@pytest.mark.asyncio
async def test_find_semantic_duplicates(client: AsyncClient):
    kbid = int(time.time() + 300)
    kb_res = await client.post("/knowledge-bases", json={"name": f"KB Semantic Test {kbid}"})
    kb_id = kb_res.json()["id"]
    
    # Adiciona dois itens que serão "semanticamente idênticos" porque o mock retorna zeros para ambos
    await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "Carros voam?", "answer": "Não."})
    await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "Veículos aéreos?", "answer": "Sim."})
    
    # Chama com ?semantic=true
    response = await client.get(f"/knowledge-bases/{kb_id}/duplicates?semantic=true")
    assert response.status_code == 200
    data = response.json()
    
    # Devem ser agrupados (pela similaridade de vetores iguais no mock)
    assert len(data["duplicates"]) >= 1
    assert data["duplicates"][0]["is_semantic"] is True

@pytest.mark.asyncio
async def test_propose_merge(client: AsyncClient, monkeypatch):
    # 1. Mock do LLM para a mesclagem
    async def mock_call_llm(*args, **kwargs):
        class MockChoice:
            def __init__(self):
                self.message = type('obj', (object,), {'content': '{"question": "Mesclado", "answer": "Tudo junto"}'})
        class MockResponse:
            def __init__(self):
                self.choices = [MockChoice()]
        return MockResponse()

    import rag_service
    monkeypatch.setattr(rag_service, "call_rag_llm", mock_call_llm)
    
    kbid = int(time.time() + 400)
    kb_res = await client.post("/knowledge-bases", json={"name": f"Merge Test {kbid}"})
    kb_id = kb_res.json()["id"]
    
    res1 = await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "A", "answer": "1"})
    res2 = await client.post(f"/knowledge-bases/{kb_id}/items", json={"question": "B", "answer": "2"})
    
    ids = [res1.json()["id"], res2.json()["id"]]
    
    merge_res = await client.post(f"/knowledge-bases/{kb_id}/propose-merge", json={"item_ids": ids})
    assert merge_res.status_code == 200
    assert merge_res.json()["proposed"]["question"] == "Mesclado"
