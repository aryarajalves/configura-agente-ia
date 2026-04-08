import pytest
import uuid
from backend.src.api.auth import create_access_token
from backend.src.models.admin import AdminRole

@pytest.mark.asyncio
async def test_inbox_rbac(client):
    # 1. Curator should have access
    curator_token = create_access_token({"sub": str(uuid.uuid4()), "role": AdminRole.CURATOR})
    resp = await client.get("/v1/inbox/", headers={"Authorization": f"Bearer {curator_token}"})
    assert resp.status_code == 200
    
    # 2. Support group/Regular user should NOT have access (if we had such role)
    # Testing with a role that is NOT in the allowed list
    regular_token = create_access_token({"sub": str(uuid.uuid4()), "role": "regular_support"})
    resp = await client.get("/v1/inbox/", headers={"Authorization": f"Bearer {regular_token}"})
    assert resp.status_code == 403
