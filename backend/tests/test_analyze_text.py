import pytest
from httpx import AsyncClient
import json

@pytest.mark.asyncio
async def test_analyze_text_tabular(client: AsyncClient):
    # Test CSV detection
    csv_text = "pergunta,resposta,categoria\nO que é?,Uma resposta,Geral\nOutra?,Mais uma,Geral"
    response = await client.post(
        "/knowledge-bases/analyze-text",
        data={"text": csv_text}
    )
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "pergunta" in data["columns"]
    assert "resposta" in data["columns"]
    assert len(data["preview"]) > 0

@pytest.mark.asyncio
async def test_analyze_text_structured_json(client: AsyncClient):
    # Test structured JSON detection
    structured_json = [
        {
            "context": [
                {
                    "metadata": "Menu Principal",
                    "context": "Conteúdo do menu"
                }
            ]
        }
    ]
    response = await client.post(
        "/knowledge-bases/analyze-text",
        data={"text": json.dumps(structured_json)}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("is_structured") is True
    assert "columns" in data

@pytest.mark.asyncio
async def test_analyze_text_invalid(client: AsyncClient):
    # Test invalid text
    response = await client.post(
        "/knowledge-bases/analyze-text",
        data={"text": "Apenas um texto qualquer sem formato de tabela ou json estruturado."}
    )
    assert response.status_code == 200 # App returns 200 with error key
    data = response.json()
    assert "error" in data
