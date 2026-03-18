import pytest
import time
import json
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import KnowledgeBaseModel, KnowledgeItemModel, AgentConfigModel
from rag_service import search_knowledge_base, calculate_coverage

# Mocking all LLM/OpenAI calls in rag_service
@pytest.fixture(autouse=True)
def mock_rag_dependencies(monkeypatch):
    class MockChoice:
        def __init__(self, content):
            self.message = type('obj', (object,), {'content': content})

    class MockResponse:
        def __init__(self, content, usage=None):
            self.choices = [MockChoice(content)]
            self.usage = usage or type('obj', (object,), {'total_tokens': 10, 'prompt_tokens': 5, 'completion_tokens': 5})

    async def mock_call_llm(*args, **kwargs):
        messages = kwargs.get("messages", args[0] if args else [])
        content = ""
        # Simulate different behaviors based on prompt
        sys_p = messages[0]["content"] if messages else ""
        user_p = messages[-1]["content"] if messages else ""

        if "Identifique o idioma" in sys_p:
            content = "english" if "hello" in user_p.lower() else "portuguese"
        elif "variações" in sys_p:
            content = json.dumps(["var 1", "var 2"])
        elif "Traduza" in sys_p:
            content = "Tradução simulada"
        elif "reordenar" in sys_p:
            content = json.dumps([0, 1])
        elif "Avalie" in sys_p:
            content = "SIM"
        
        return MockResponse(content)

    async def mock_get_emb(text):
        return [0.1] * 1536, type('obj', (object,), {'total_tokens': 10})

    import rag_service
    monkeypatch.setattr(rag_service, "call_rag_llm", mock_call_llm)
    monkeypatch.setattr(rag_service, "get_embedding", mock_get_emb)

@pytest.mark.asyncio
async def test_rag_search_parent_expansion(db_session: AsyncSession):
    # 1. Setup KB and Items
    kbid = int(time.time() + 200)
    kb = KnowledgeBaseModel(name=f"RAG Test KB {kbid}")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)

    # Parent Item
    parent = KnowledgeItemModel(
        knowledge_base_id=kb.id,
        question="What is the company policy?",
        answer="Full policy content...",
        embedding=[0.1] * 1536
    )
    db_session.add(parent)
    await db_session.commit()
    await db_session.refresh(parent)

    # Child Item
    child = KnowledgeItemModel(
        knowledge_base_id=kb.id,
        question="Company holiday?",
        answer="Look at policy.",
        embedding=[0.1] * 1536,
        parent_id=parent.id
    )
    db_session.add(child)
    await db_session.commit()

    # 2. Run Search
    results, usage = await search_knowledge_base(db_session, "holiday", kb_id=kb.id)

    # 3. Verify Expansion
    assert len(results) > 0
    # Should find child but return parent due to expansion
    assert results[0]["id"] == parent.id
    assert results[0]["search_type"] == "parent_expanded"
    assert usage.prompt_tokens > 0

@pytest.mark.asyncio
async def test_rag_multi_kb_search(db_session: AsyncSession):
    kbid1 = int(time.time() + 210)
    kbid2 = int(time.time() + 211)
    
    kb1 = KnowledgeBaseModel(name=f"KB1 {kbid1}")
    kb2 = KnowledgeBaseModel(name=f"KB2 {kbid2}")
    db_session.add_all([kb1, kb2])
    await db_session.commit()
    await db_session.refresh(kb1)
    await db_session.refresh(kb2)

    item1 = KnowledgeItemModel(knowledge_base_id=kb1.id, question="Q1", answer="A1", embedding=[0.1] * 1536)
    item2 = KnowledgeItemModel(knowledge_base_id=kb2.id, question="Q2", answer="A2", embedding=[0.1] * 1536)
    db_session.add_all([item1, item2])
    await db_session.commit()

    # Search in both
    results, _ = await search_knowledge_base(db_session, "Q1", kb_ids=[kb1.id, kb2.id])
    
    kb_ids_found = {r["kb_id"] for r in results}
    assert kb1.id in kb_ids_found
    assert kb2.id in kb_ids_found

@pytest.mark.asyncio
async def test_rag_agent_linked_search(db_session: AsyncSession):
    kbid = int(time.time() + 220)
    aid = int(time.time() + 221)
    
    kb = KnowledgeBaseModel(name=f"Agent KB {kbid}")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)

    agent = AgentConfigModel(name=f"RAG Agent {aid}", knowledge_base_id=kb.id)
    db_session.add(agent)
    await db_session.commit()
    await db_session.refresh(agent)

    item = KnowledgeItemModel(knowledge_base_id=kb.id, question="Agent Question", answer="Agent Answer", embedding=[0.1] * 1536)
    db_session.add(item)
    await db_session.commit()

    # Search via agent_id
    results, _ = await search_knowledge_base(db_session, "Agent Question", agent_id=agent.id)
    assert len(results) > 0
    assert results[0]["kb_id"] == kb.id

@pytest.mark.asyncio
async def test_rag_coverage(db_session: AsyncSession):
    kbid = int(time.time() + 230)
    kb = KnowledgeBaseModel(name=f"Coverage KB {kbid}")
    db_session.add(kb)
    await db_session.commit()
    await db_session.refresh(kb)

    # Item exactly matching our mock embedding
    item = KnowledgeItemModel(knowledge_base_id=kb.id, question="Coverage Q", answer="Coverage A", embedding=[0.1] * 1536)
    db_session.add(item)
    await db_session.commit()

    questions = ["Coverage Q", "Unknown Question"]
    # We need to monkeypatch search_knowledge_base within calculate_coverage to return specific scores if needed,
    # or just trust our mock embedding [0.1] against query embedding [0.1] gives dist 0 -> sim 1.
    
    report = await calculate_coverage(db_session, questions, kb.id)
    
    assert len(report) == 2
    assert report[0]["status"] == "green" # Should be perfectly similar due to same mock embeddings
    assert report[0]["score"] == 1.0
