import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock
from google_calendar import GoogleCalendarService, resolve_color_id

@pytest.fixture
def mock_db():
    mock = AsyncMock()
    mock.add = MagicMock() # SQLAlchemy add is sync
    return mock

@pytest.fixture
def gcal_service(mock_db):
    return GoogleCalendarService(agent_id=1, db=mock_db)

@pytest.mark.asyncio
async def test_get_auth_url(gcal_service):
    with patch("google_calendar.Flow.from_client_config") as mock_flow_class:
        mock_flow = MagicMock()
        mock_flow_class.return_value = mock_flow
        mock_flow.authorization_url.return_value = ("https://mock-auth-url.com", "state")
        
        with patch.dict("os.environ", {"GOOGLE_CLIENT_ID": "id", "GOOGLE_CLIENT_SECRET": "secret", "GOOGLE_REDIRECT_URI": "http://localhost"}):
            gcal_service.client_id = "id"
            gcal_service.client_secret = "secret"
            url = await gcal_service.get_auth_url()
            assert url == "https://mock-auth-url.com"

@pytest.mark.asyncio
async def test_save_tokens(gcal_service, mock_db):
    with patch("google_calendar.Flow.from_client_config") as mock_flow_class:
        mock_flow = MagicMock()
        mock_flow_class.return_value = mock_flow
        
        mock_creds = MagicMock()
        mock_creds.token = "access_token"
        mock_creds.refresh_token = "refresh_token"
        mock_creds.expiry = None
        mock_creds.scopes = ["scope1"]
        mock_flow.credentials = mock_creds
        
        # Mock DB results
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_db.execute.return_value = mock_result
        
        with patch.dict("os.environ", {"GOOGLE_CLIENT_ID": "id", "GOOGLE_CLIENT_SECRET": "secret", "GOOGLE_REDIRECT_URI": "http://localhost"}):
            gcal_service.client_id = "id"
            gcal_service.client_secret = "secret"
            success = await gcal_service.save_tokens("mock_code")
            assert success is True
            assert mock_db.add.called
            assert mock_db.commit.called

@pytest.mark.asyncio
async def test_list_events(gcal_service):
    with patch.object(GoogleCalendarService, "get_service", new_callable=AsyncMock) as mock_get_service:
        mock_service = MagicMock()
        mock_get_service.return_value = mock_service
        
        mock_events_list = MagicMock()
        mock_service.events.return_value.list.return_value = mock_events_list
        mock_events_list.execute.return_value = {"items": [{"id": "evt1", "summary": "Event 1"}]}
        
        events = await gcal_service.list_events()
        assert len(events) == 1
        assert events[0]["summary"] == "Event 1"

@pytest.mark.asyncio
async def test_create_event(gcal_service):
    with patch.object(GoogleCalendarService, "get_service", new_callable=AsyncMock) as mock_get_service:
        mock_service = MagicMock()
        mock_get_service.return_value = mock_service
        
        mock_insert = MagicMock()
        mock_service.events.return_value.insert.return_value = mock_insert
        mock_insert.execute.return_value = {"id": "new_evt", "htmlLink": "http://link"}
        
        event = await gcal_service.create_event(
            summary="Meeting",
            start_time="2024-10-25T10:00:00Z",
            end_time="2024-10-25T11:00:00Z"
        )
        assert event["id"] == "new_evt"

def test_resolve_color_id():
    assert resolve_color_id("vermelho") == "11"
    assert resolve_color_id("azul") == "7"
    assert resolve_color_id("banana") == "5"
    assert resolve_color_id("1") == "1"
    assert resolve_color_id("99") is None
    assert resolve_color_id(None) is None
