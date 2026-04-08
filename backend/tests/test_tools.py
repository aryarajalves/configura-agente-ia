import pytest
import time
import random
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_tool(client: AsyncClient):
    tid = random.randint(1000, 9999)
    tool_data = {
        "name": f"test_tool_{tid}",
        "description": "A tool for testing.",
        "parameters_schema": '{"type": "object", "properties": {"arg": {"type": "string"}}}',
        "webhook_url": "https://example.com/webhook"
    }
    response = await client.post("/tools", json=tool_data)
    assert response.status_code == 200
    assert response.json()["name"] == f"test_tool_{tid}"
    return response.json()["id"]

@pytest.mark.asyncio
async def test_list_tools(client: AsyncClient):
    response = await client.get("/tools")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_update_tool(client: AsyncClient):
    # 1. Create
    tid = random.randint(1000, 9999)
    tool_data = {
        "name": f"up_tool_{tid}",
        "description": "Desc V1",
        "parameters_schema": '{}',
        "webhook_url": "https://old.com"
    }
    res = await client.post("/tools", json=tool_data)
    tool_id = res.json()["id"]
    
    # 2. Update
    update_data = {
        "name": f"up_tool_{tid}",
        "description": "Desc V2",
        "parameters_schema": '{"updated": true}',
        "webhook_url": "https://new.com"
    }
    res2 = await client.put(f"/tools/{tool_id}", json=update_data)
    assert res2.status_code == 200
    assert res2.json()["description"] == "Desc V2"
    assert res2.json()["webhook_url"] == "https://new.com"

@pytest.mark.asyncio
async def test_delete_tool(client: AsyncClient):
    # 1. Create
    tid = random.randint(1000, 9999)
    res = await client.post("/tools", json={"name": f"del_tool_{tid}", "description": "X", "parameters_schema": "{}", "webhook_url": "X"})
    assert res.status_code == 200
    tool_id = res.json()["id"]
    
    # 2. Delete
    res2 = await client.delete(f"/tools/{tool_id}")
    assert res2.status_code == 200
    
    # 3. Verify
    res3 = await client.get("/tools")
    ids = [t["id"] for t in res3.json()]
    assert tool_id not in ids

@pytest.mark.asyncio
async def test_tool_auth_missing(db_session):
    # Test without the client fixture's auto-auth
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/tools")
        assert response.status_code == 403


