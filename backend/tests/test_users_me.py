import pytest
import os
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_users_me_admin(client: AsyncClient):
    # Login as admin
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    api_key = os.getenv("AGENT_API_KEY")
    
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-API-Key": api_key
    }
    
    response = await client.get("/users/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == admin_email
    assert data["role"] == "Super Admin"

@pytest.mark.asyncio
async def test_update_users_me_name(client: AsyncClient):
    # Login as admin
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    api_key = os.getenv("AGENT_API_KEY")
    
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-API-Key": api_key
    }
    
    # Update name
    new_name = "Super Admin Updated"
    response = await client.put("/users/me", json={"name": new_name}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == new_name
    assert data["email"] == admin_email # Email shouldn't change

@pytest.mark.asyncio
async def test_update_users_me_restrict_admin_email(client: AsyncClient):
    # Login as admin
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    api_key = os.getenv("AGENT_API_KEY")
    
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-API-Key": api_key
    }
    
    # Try to update email (should be ignored by the logic I implemented)
    response = await client.put("/users/me", json={"email": "hacker@example.com"}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == admin_email # Remains original
