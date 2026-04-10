import pytest
import uuid
from src.models.stress_test import StressTestPersona
from src.models.admin import AdminRole
from src.api.auth import create_access_token

@pytest.fixture
def superadmin_token():
    return create_access_token({"sub": str(uuid.uuid4()), "role": AdminRole.SUPERADMIN})

@pytest.fixture
def admin_headers(superadmin_token):
    return {"Authorization": f"Bearer {superadmin_token}"}

@pytest.mark.asyncio
async def test_personas_api_flow(client, db_session, admin_headers):
    # 1. Setup - create a persona
    persona = StressTestPersona(
        name="Test API Persona",
        description="API testing",
        behavior_config={"tone": "test"}
    )
    db_session.add(persona)
    await db_session.commit()
    
    # 2. List personas
    response = await client.get("/v1/stress-tests/personas", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert any(p["name"] == "Test API Persona" for p in data)

@pytest.mark.asyncio
async def test_create_stress_test_session(client, db_session, admin_headers):
    # 1. Setup - persona
    persona = StressTestPersona(
        name="Trigger Persona",
        behavior_config={"goal": "fail"}
    )
    db_session.add(persona)
    await db_session.commit()
    
    # 2. Trigger test
    response = await client.post("/v1/stress-tests/", json={
        "persona_id": str(persona.id)
    }, headers=admin_headers)
    assert response.status_code == 200
    session_id = response.json()["data"]["id"]
    
    # 3. Get status - use set of allowed lowercase statuses because SQLAlchemy/TaskIQ might return them
    status_response = await client.get(f"/v1/stress-tests/{session_id}", headers=admin_headers)
    assert status_response.status_code == 200
    current_status = status_response.json()["data"]["status"]
    assert current_status.upper() in ["QUEUED", "PROCESSING", "SUCCESS"]
