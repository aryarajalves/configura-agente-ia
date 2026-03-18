import pytest
from httpx import AsyncClient
from main import app
from httpx import ASGITransport

@pytest.mark.asyncio
async def test_google_auth_url_authenticated(client: AsyncClient):
    response = await client.get("/integrations/google/auth-url")
    assert response.status_code == 200
    assert "auth_url" in response.json()

@pytest.mark.asyncio
async def test_google_status_authenticated(client: AsyncClient):
    response = await client.get("/integrations/google/status")
    assert response.status_code == 200
    assert "connected" in response.json()

@pytest.mark.asyncio
async def test_integrations_auth_missing():
    # Test without the client fixture's auto-auth
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Auth URL
        res1 = await ac.get("/integrations/google/auth-url")
        assert res1.status_code == 403
        
        # Status
        res2 = await ac.get("/integrations/google/status")
        assert res2.status_code == 403

@pytest.mark.asyncio
async def test_google_callback_public(client: AsyncClient):
    # Callback must be public for Google redirects
    # We test with a dummy code/state which will likely fail logic but should be reachable
    response = await client.get("/integrations/google/callback?code=mock_code&state=global")
    # It might redirect or error out depending on Google API mock, 
    # but the point is it shouldn't return 403 Forbidden due to missing API Key.
    assert response.status_code != 403
