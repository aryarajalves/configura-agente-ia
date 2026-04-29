import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from rag_service import (
    detect_language,
    translate_to_portuguese,
    rerank_results,
    evaluate_rag_relevance,
    generate_multi_queries
)

# ─────────────────────────────────────────────
# detect_language
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_detect_language_portuguese():
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="portuguese"))]
        mock_response.usage = MagicMock(total_tokens=10)
        mock_call.return_value = mock_response

        lang, usage = await detect_language("Olá, tudo bem?")
        assert lang == "portuguese"
        assert usage is not None

@pytest.mark.asyncio
async def test_detect_language_unknown_becomes_simple():
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=" Klingon "))]
        mock_response.usage = MagicMock(total_tokens=5)
        mock_call.return_value = mock_response

        lang, _ = await detect_language("Qapla'")
        assert lang == "simple"

# ─────────────────────────────────────────────
# translate_to_portuguese
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_translate_to_portuguese_success():
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Como vai você?"))]
        mock_call.return_value = mock_response

        translated, usage = await translate_to_portuguese("How are you?")
        assert translated == "Como vai você?"

@pytest.mark.asyncio
async def test_translate_to_portuguese_fallback_on_error():
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_call.side_effect = Exception("LLM Error")
        translated, usage = await translate_to_portuguese("Error case")
        # Should fall back to the original text, not crash
        assert translated == "Error case"

# ─────────────────────────────────────────────
# rerank_results
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rerank_results_reorders_by_llm():
    items = [
        {"id": 1, "question": "What is A?", "answer": "A is alpha"},
        {"id": 2, "question": "What is B?", "answer": "B is beta"}
    ]
    query = "Tell me about beta"

    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps([1, 0])))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        reranked, usage = await rerank_results(query, items)
        assert reranked[0]["id"] == 2     # index 1 -> should be first
        assert reranked[1]["id"] == 1     # index 0 -> should be second
        assert "reranked" in reranked[0]["search_type"]

@pytest.mark.asyncio
async def test_rerank_results_handles_dict_format():
    """LLM sometimes returns {"order": [...]} instead of plain list."""
    items = [
        {"id": 1, "question": "Q1", "answer": "A1"},
        {"id": 2, "question": "Q2", "answer": "A2"}
    ]

    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({"order": [1, 0]})))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        reranked, _ = await rerank_results("test query", items)
        assert reranked[0]["id"] == 2
        assert reranked[1]["id"] == 1

@pytest.mark.asyncio
async def test_rerank_results_single_item_skipped():
    """Single-item lists should be returned immediately without calling LLM."""
    items = [{"id": 1, "question": "Q1", "answer": "A1"}]

    with patch("rag_service.call_rag_llm") as mock_call:
        result, _ = await rerank_results("query", items)
        mock_call.assert_not_called()
        assert len(result) == 1

# ─────────────────────────────────────────────
# evaluate_rag_relevance (NEW granular version with JSON + TRUST_THRESHOLD)
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evaluate_rag_relevance_returns_relevant_indices():
    """LLM returns JSON with useful_indices -> only those items kept."""
    items = [
        {"id": 10, "question": "Tipos de dívidas", "answer": "Existem 3 tipos...", "distance": 0.55},
        {"id": 11, "question": "Como fazer login", "answer": "Basta clicar em...", "distance": 0.80},
    ]
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({"useful_indices": [0]})))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        result, _ = await evaluate_rag_relevance("Quais são os tipos de dívida", items)
        assert len(result) == 1
        assert result[0]["id"] == 10

@pytest.mark.asyncio
async def test_evaluate_rag_relevance_trust_threshold_bypasses_filter():
    """Items with distance < 0.45 must be kept even if LLM says useful_indices = []."""
    items = [
        {"id": 42, "question": "Exato match", "answer": "Resposta exata", "distance": 0.40},
    ]
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        # LLM says nothing is relevant...
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({"useful_indices": []})))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        result, _ = await evaluate_rag_relevance("Exato match", items)
        # But trust threshold is 0.45, and distance=0.40 < 0.45, so it should be kept!
        assert any(item["id"] == 42 for item in result), \
            "Item with distance < TRUST_THRESHOLD must bypass the filter"

@pytest.mark.asyncio
async def test_evaluate_rag_relevance_fallback_when_all_filtered():
    """When LLM filters everything, the function has a secondary fallback:
    if top item has distance < 0.6, keep it to prevent empty-handed results."""
    items = [
        # distance=0.50 is < 0.6, so the in-function fallback should kick in
        {"id": 5, "question": "Melhor resultado", "answer": "...", "distance": 0.50},
        {"id": 6, "question": "Pior resultado", "answer": "...", "distance": 0.90},
    ]
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({"useful_indices": []})))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        # evaluate_rag_relevance has an internal fallback: if everything is filtered
        # but top-1 has distance < 0.6, it keeps that item.
        result, _ = await evaluate_rag_relevance("pergunta", items)
        # The internal fallback at < 0.6 should preserve the top item (id=5, dist=0.50)
        assert len(result) == 1
        assert result[0]["id"] == 5

@pytest.mark.asyncio
async def test_evaluate_rag_relevance_truly_irrelevant_filtered():
    """When all items have high distance and LLM says nothing is relevant, return empty."""
    items = [
        {"id": 7, "question": "Receita de bolo", "answer": "Coloque o açúcar...", "distance": 0.95},
    ]
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({"useful_indices": []})))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        result, _ = await evaluate_rag_relevance("pergunta sobre finanças", items)
        # dist=0.95 is NOT < trust threshold (0.45) nor < 0.6 fallback, so result is empty
        assert result == []


@pytest.mark.asyncio
async def test_evaluate_rag_relevance_empty_input():
    """Empty items should return empty without calling LLM."""
    with patch("rag_service.call_rag_llm") as mock_call:
        result, _ = await evaluate_rag_relevance("query", [])
        mock_call.assert_not_called()
        assert result == []

@pytest.mark.asyncio
async def test_evaluate_rag_relevance_invalid_json_fallback():
    """If LLM returns invalid JSON but looks positive, keep all items."""
    items = [
        {"id": 1, "question": "Q", "answer": "A", "distance": 0.80},
    ]
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        # Returns SIM instead of JSON
        mock_response.choices = [MagicMock(message=MagicMock(content="SIM"))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        result, _ = await evaluate_rag_relevance("query", items)
        # SIM found in content -> keep all
        assert len(result) == 1

# ─────────────────────────────────────────────
# generate_multi_queries  
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_multi_queries_includes_original():
    query = "how to bake a cake"

    with patch("rag_service.call_rag_llm") as mock_call:
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps(["cake recipe", "baking instructions"])))]
        mock_response.usage = MagicMock()
        mock_call.return_value = mock_response

        queries, usage = await generate_multi_queries(query, count=2)
        # Must include variations + the original query
        assert len(queries) >= 2
        assert query in queries
        assert "cake recipe" in queries

@pytest.mark.asyncio
async def test_generate_multi_queries_fallback_on_error():
    """If LLM fails, should return the original query only."""
    with patch("rag_service.call_rag_llm") as mock_call:
        mock_call.side_effect = Exception("API Error")

        queries, _ = await generate_multi_queries("original query", count=2)
        assert queries == ["original query"]
