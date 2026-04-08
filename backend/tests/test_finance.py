import pytest
from httpx import AsyncClient
from models import InteractionLog
from config_store import USD_TO_BRL

@pytest.mark.asyncio
async def test_get_dashboard_stats(client: AsyncClient):
    response = await client.get("/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_agents" in data
    assert "total_cost" in data

@pytest.mark.asyncio
async def test_get_financial_report(client: AsyncClient):
    response = await client.get("/financial/report")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "grand_total_cost" in data

@pytest.mark.asyncio
async def test_financial_report_includes_extractions_and_tests(client: AsyncClient, db_session):
    from datetime import datetime
    now = datetime.utcnow()
    cost = 0.01
    
    log_rag = InteractionLog(
        session_id="SYS_EXTRACTION_KB_99",
        user_message="Extração RAG (Test)",
        agent_response="OK",
        model_used="gpt-4o-mini",
        input_tokens=1000,
        output_tokens=500,
        cost_usd=cost,
        cost_brl=cost * USD_TO_BRL,
        timestamp=now
    )
    log_tester = InteractionLog(
        session_id="SYS_TESTER",
        user_message="Teste Simulador",
        agent_response="OK",
        model_used="gpt-4o",
        input_tokens=100,
        output_tokens=50,
        cost_usd=cost,
        cost_brl=cost * USD_TO_BRL,
        timestamp=now
    )
    db_session.add_all([log_rag, log_tester])
    await db_session.commit()

    response = await client.get("/financial/report")
    assert response.status_code == 200
    data = response.json()
    items = data.get("items", [])
    
    # Verifica se os custos extraídos aparecem para logs sem agent_id
    found_mini = any("gpt-4o-mini" in item["agent_name"] and "Sistema" in item["agent_name"] for item in items)
    found_4o = any("gpt-4o" in item["agent_name"] and "Sistema" in item["agent_name"] for item in items)
    
    if not (found_mini or found_4o):
        print(f"DEBUG ITEMS: {items}")

    assert found_mini or found_4o
    assert data["grand_total_cost"] >= (cost * USD_TO_BRL * 2)
