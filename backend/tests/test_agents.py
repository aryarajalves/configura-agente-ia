import pytest
import time
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_agent(client: AsyncClient):
    aid = int(time.time())
    agent_data = {
        "name": f"Test Agent {aid}",
        "model": "gpt-4o-mini",
        "system_prompt": "You are a test agent.",
        "temperature": 0.7,
        "is_active": True
    }
    response = await client.post("/agents", json=agent_data)
    assert response.status_code == 200
    assert response.json()["name"] == f"Test Agent {aid}"

@pytest.mark.asyncio
async def test_list_agents(client: AsyncClient):
    response = await client.get("/agents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_update_agent(client: AsyncClient):
    aid = int(time.time() + 1)
    # Primeiro criamos
    agent_data = {"name": f"Old Name {aid}"}
    create_res = await client.post("/agents", json=agent_data)
    agent_id = create_res.json()["id"]
    
    # Atualizamos
    update_data = {"name": f"New Name {aid}"}
    response = await client.put(f"/agents/{agent_id}", json=update_data)
    assert response.status_code == 200
    assert response.json()["name"] == f"New Name {aid}"

@pytest.mark.asyncio
async def test_get_agent_by_id(client: AsyncClient):
    # Setup
    create_res = await client.post("/agents", json={"name": "Get Me"})
    agent_id = create_res.json()["id"]
    
    # Test Get
    response = await client.get(f"/agents/{agent_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Get Me"

@pytest.mark.asyncio
async def test_get_agent_models(client: AsyncClient):
    response = await client.get("/agents/models")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_toggle_agent(client: AsyncClient):
    create_res = await client.post("/agents", json={"name": "Toggle Me", "is_active": True})
    agent_id = create_res.json()["id"]
    assert create_res.json()["is_active"] is True
    
    response = await client.post(f"/agents/{agent_id}/toggle")
    assert response.status_code == 200
    assert response.json()["is_active"] is False

@pytest.mark.asyncio
async def test_duplicate_agent(client: AsyncClient):
    create_res = await client.post("/agents", json={"name": "Duplicate Me", "system_prompt": "Template"})
    agent_id = create_res.json()["id"]
    
    response = await client.post(f"/agents/{agent_id}/duplicate")
    assert response.status_code == 200
    assert response.json()["name"] == "Duplicate Me (Cópia)"
    assert response.json()["system_prompt"] == "Template"

@pytest.mark.asyncio
async def test_delete_agent(client: AsyncClient):
    create_res = await client.post("/agents", json={"name": "Delete Me"})
    agent_id = create_res.json()["id"]
    
    # Check deletion response
    response_del = await client.delete(f"/agents/{agent_id}")
    assert response_del.status_code == 200
    
    # Confirm deletion
    response_get = await client.get(f"/agents/{agent_id}")
    assert response_get.status_code == 404

@pytest.mark.asyncio
async def test_agent_drafts(client: AsyncClient):
    # Cria o agente primeiro
    create_res = await client.post("/agents", json={"name": "Agent With Draft"})
    agent_id = create_res.json()["id"]
    
    # Cria Rascunho
    draft_payload = {
        "agent_id": agent_id,
        "prompt_text": "Novo prompt em andamento",
        "version_name": "Tentativa 1"
    }
    response_post = await client.post(f"/agents/{agent_id}/drafts", json=draft_payload)
    assert response_post.status_code == 200
    assert response_post.json()["version_name"] == "Tentativa 1"
    
    # Lista Rascunhos
    response_get = await client.get(f"/agents/{agent_id}/drafts")
    assert response_get.status_code == 200
    assert len(response_get.json()) >= 1
    assert response_get.json()[0]["prompt_text"] == "Novo prompt em andamento"

@pytest.mark.asyncio
async def test_delete_agent_drafts(client: AsyncClient):
    create_res = await client.post("/agents", json={"name": "Agent With Delete Draft"})
    agent_id = create_res.json()["id"]
    
    draft_payload = {
        "agent_id": agent_id,
        "prompt_text": "Draft temporario",
        "version_name": "Excluir Logo Depois"
    }
    res_draft = await client.post(f"/agents/{agent_id}/drafts", json=draft_payload)
    draft_id = res_draft.json()["id"]

    res_del = await client.delete(f"/drafts/{draft_id}")
    assert res_del.status_code == 200
    
    # Verifica
    res_get = await client.get(f"/agents/{agent_id}/drafts")
    assert res_get.status_code == 200
    assert len([d for d in res_get.json() if d["id"] == draft_id]) == 0

