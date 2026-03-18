import pytest
import os
import random
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    uid = random.randint(10000, 99999)
    user_data = {
        "name": f"Test User {uid}",
        "email": f"test_{uid}@example.com",
        "password": "password123",
        "role": "Usuário",
        "status": "ATIVO"
    }
    # Must login first
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post("/users", json=user_data, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == f"test_{uid}@example.com"
    assert "id" in data

@pytest.mark.asyncio
async def test_get_users(client: AsyncClient):
    # Must login first to get a token for administrative routes
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    
    response = await client.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_login_admin(client: AsyncClient):
    # Credenciais do .env (fallback se não encontrar)
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    
    login_data = {
        "email": admin_email,
        "password": admin_password
    }
    response = await client.post("/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data

@pytest.mark.asyncio
async def test_login_user(client: AsyncClient):
    uid = random.randint(10000, 99999)
    # Must login as admin to create a user
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    login_admin = await client.post("/login", json={"email": admin_email, "password": admin_password})
    admin_token = login_admin.json()["token"]
    
    # Criamos um usuário comum
    user_data = {
        "name": f"Login User {uid}",
        "email": f"login_{uid}@example.com",
        "password": "password123"
    }
    create_res = await client.post("/users", json=user_data, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 200
    
    login_data = {
        "email": f"login_{uid}@example.com",
        "password": "password123"
    }
    response = await client.post("/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
@pytest.mark.asyncio
async def test_update_user(client: AsyncClient):
    uid = random.randint(10000, 99999)
    # Must login
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create
    user_data = {
        "name": f"To Update {uid}",
        "email": f"update_{uid}@example.com",
        "password": "original_pass"
    }
    create_res = await client.post("/users", json=user_data, headers=headers)
    user_id = create_res.json()["id"]
    
    # 2. Update
    update_data = {
        "name": "Updated Name",
        "email": f"update_{uid}@example.com",
        "password": "new_password"
    }
    response = await client.put(f"/users/{user_id}", json=update_data, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"

@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient):
    uid = random.randint(10000, 99999)
    # Must login
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create
    user_data = {
        "name": f"To Delete {uid}",
        "email": f"delete_{uid}@example.com",
        "password": "password"
    }
    create_res = await client.post("/users", json=user_data, headers=headers)
    user_id = create_res.json()["id"]
    
    # 2. Delete
    response = await client.delete(f"/users/{user_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    
    # 3. Verify deletion
    list_res = await client.get("/users", headers=headers)
    user_ids = [u["id"] for u in list_res.json()]
    assert user_id not in user_ids

@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    # Invalid email/password
    login_data = {
        "email": "nonexistent@example.com",
        "password": "wrong_password"
    }
    response = await client.post("/login", json=login_data)
    assert response.status_code == 401
    assert "incorretos" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_create_user_invalid_data(client: AsyncClient):
    # Setup Auth
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]

    # Missing required 'email'
    user_data = {
        "name": "Invalid User",
        "password": "password"
    }
    response = await client.post("/users", json=user_data, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 422 # Unprocessable Entity (FastAPI validation)

@pytest.mark.asyncio
async def test_system_reset_authenticated(client: AsyncClient):
    # 1. Login to get token
    admin_email = os.getenv("ADMIN_EMAIL", "aryarajmarketing@gmail.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "123456")
    login_res = await client.post("/login", json={"email": admin_email, "password": admin_password})
    token = login_res.json()["token"]
    
    # 2. Call reset with token
    response = await client.post("/system/reset-database", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "All data wiped" in response.json()["message"]

@pytest.mark.asyncio
async def test_users_auth_missing():
    from main import app
    from httpx import AsyncClient, ASGITransport
    # Test 1: No API Key, No Token
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res1 = await ac.get("/users")
        assert res1.status_code == 403 # Missing API Key
        
    # Test 2: Valid API Key, NO JWT Token (Should fail now)
    valid_apikey = os.getenv("AGENT_API_KEY", "test-key")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"X-API-Key": valid_apikey}) as ac:
        res2 = await ac.get("/users")
        assert res2.status_code == 401 # Unauthorized (Token missing)
        
        res3 = await ac.post("/system/reset-database")
        assert res3.status_code == 401 # Unauthorized
