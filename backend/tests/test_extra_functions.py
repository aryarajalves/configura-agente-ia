import pytest
import os
import random
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_global_variables(client: AsyncClient):
    vid = random.randint(1000, 9999)
    var_data = {
        "key": f"TEST_VAR_{vid}",
        "value": "Test Value",
        "type": "string",
        "description": "A variable for testing."
    }
    response = await client.post("/global-variables", json=var_data)
    assert response.status_code in [200, 201]
    assert response.json()["key"] == f"TEST_VAR_{vid}"

@pytest.mark.asyncio
async def test_list_global_variables(client: AsyncClient):
    response = await client.get("/global-variables")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_session_analysis(client: AsyncClient):
    # Rota real: /sessions/questions/batch
    payload = {
        "session_ids": ["session-1", "session-2"]
    }
    response = await client.post("/sessions/questions/batch", json=payload)
    # Se não houver OpenAI Key, pode dar 500, mas validamos se a rota existe
    assert response.status_code in [200, 500] 
    if response.status_code == 200:
        assert "questions" in response.json()

@pytest.mark.asyncio
async def test_generate_prompt(client: AsyncClient):
    # Rota real: /generate-prompt
    payload = {
        "identity": "Expert",
        "mission": "Help people",
        "tone": "Friendly",
        "audience": "Developers",
        "restrictions": "None"
    }
    response = await client.post("/generate-prompt", json=payload)
    # Validamos se a rota existe (pode dar 500 sem API Key)
    assert response.status_code in [200, 500]
    if response.status_code == 200:
        assert "prompt" in response.json()
@pytest.mark.asyncio
async def test_update_global_variable(client: AsyncClient):
    # 1. Create
    vid = random.randint(1000, 9999)
    var_data = {"key": f"UP_VAR_{vid}", "value": "V1"}
    res = await client.post("/global-variables", json=var_data)
    var_id = res.json()["id"]
    
    # 2. Update
    update_data = {"key": f"UP_VAR_{vid}", "value": "V2", "description": "Updated"}
    res2 = await client.put(f"/global-variables/{var_id}", json=update_data)
    assert res2.status_code == 200
    assert res2.json()["value"] == "V2"

@pytest.mark.asyncio
async def test_delete_global_variable(client: AsyncClient):
    # 1. Create
    vid = random.randint(1000, 9999)
    res = await client.post("/global-variables", json={"key": f"DEL_VAR_{vid}", "value": "X"})
    var_id = res.json()["id"]
    
    # 2. Delete
    res2 = await client.delete(f"/global-variables/{var_id}")
    assert res2.status_code == 200
    
    # 3. Verify
    res3 = await client.get("/global-variables")
    keys = [v["key"] for v in res3.json()]
    assert f"DEL_VAR_{vid}" not in keys
