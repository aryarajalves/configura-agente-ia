import pytest
import json
import time
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_feedback_flow(client: AsyncClient):
    # 1. Create agent
    agent_res = await client.post("/agents", json={"name": "FT Test Agent"})
    agent_id = agent_res.json()["id"]
    
    # 2. Add feedback
    payload = {
        "agent_id": agent_id,
        "user_message": "Hello",
        "original_response": "Hi",
        "rating": "negative",
        "corrected_response": "Olá!",
        "correction_note": "Better greeting"
    }
    response = await client.post("/feedback", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["user_message"] == "Hello"
    assert data["corrected_response"] == "Olá!"
    return data["id"]

@pytest.mark.asyncio
async def test_list_and_filter_feedback(client: AsyncClient):
    # Already has feedback from before or we add one
    await client.post("/feedback", json={
        "agent_id": 1,
        "user_message": "List test",
        "original_response": "X",
        "rating": "positive"
    })
    
    response = await client.get("/feedback")
    assert response.status_code == 200
    assert len(response.json()) > 0
    
    # Filter by rating
    res_pos = await client.get("/feedback?rating=positive")
    for item in res_pos.json():
        assert item["rating"] == "positive"

@pytest.mark.asyncio
async def test_update_and_delete_feedback(client: AsyncClient):
    # 1. Create
    res = await client.post("/feedback", json={
        "agent_id": 1,
        "user_message": "Temp",
        "original_response": "Old",
        "rating": "negative"
    })
    fid = res.json()["id"]
    
    # 2. Update
    await client.patch(f"/feedback/{fid}", json={"corrected_response": "Fixed"})
    
    # 3. Delete
    await client.delete(f"/feedback/{fid}")
    
    # 4. Verify
    verify = await client.get("/feedback")
    ids = [f["id"] for f in verify.json()]
    assert fid not in ids

@pytest.mark.asyncio
async def test_fine_tuning_auth_missing():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res1 = await ac.get("/feedback")
        assert res1.status_code == 403
        
        res2 = await ac.post("/fine-tuning/start", json={"agent_id": 1})
        assert res2.status_code == 403

@pytest.mark.asyncio
async def test_fine_tuning_export(client: AsyncClient):
    # Create corrected feedback
    agent_res = await client.post("/agents", json={"name": "Export Agent"})
    agent_id = agent_res.json()["id"]
    
    await client.post("/feedback", json={
        "agent_id": agent_id,
        "user_message": "Export Me",
        "original_response": "No",
        "rating": "negative",
        "corrected_response": "Yes"
    })
    
    response = await client.get(f"/feedback/export/{agent_id}")
    assert response.status_code == 200
    assert "Export Me" in response.text
    assert "Yes" in response.text

@pytest.mark.asyncio
async def test_openai_job_listing_mocked(client: AsyncClient, monkeypatch):
    # Mocking OpenAI to avoid real API calls and ensure route works
    mock_jobs = AsyncMock()
    mock_jobs.list.return_value = type('obj', (), {'data': []})
    
    mock_models = AsyncMock()
    mock_models.list.return_value = type('obj', (), {'data': []})
    
    mock_client_instance = AsyncMock()
    mock_client_instance.fine_tuning.jobs = mock_jobs
    mock_client_instance.models = mock_models
    
    import openai
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: mock_client_instance)
    
    response = await client.get("/fine-tuning/jobs")
    assert response.status_code == 200
    assert response.json() == []
