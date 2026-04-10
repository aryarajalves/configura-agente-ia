import pytest
import uuid
from src.services.simulation_orchestrator import SimulationOrchestrator
from src.models.agent import Agent, AgentStatus
from unittest.mock import patch, AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_simulation_orchestrator_flow(db_session):
    # Setup
    agent_id = uuid.uuid4()
    agent = Agent(
        id=agent_id,
        name="Test Agent",
        status=AgentStatus.ACTIVE,
        superadmin_id=uuid.uuid4(),
        model_fast_id="gpt-fast",
        model_analytic_id="gpt-analytic"
    )
    db_session.add(agent)
    await db_session.commit()

    # Monkeypatch the local imports inside methods
    # OrchestratorService.route_decision uses 'from src.database import AsyncSessionLocal'
    
    # We need to mock the CALL to AsyncSessionLocal() to return a mock context manager
    mock_session = AsyncMock()
    # Mock result of await db.execute(...)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = agent
    mock_session.execute.return_value = mock_result
    
    mock_session_factory = MagicMock()
    mock_session_factory.return_value.__aenter__.return_value = mock_session

    with patch("src.database.AsyncSessionLocal", mock_session_factory):
        orchestrator = SimulationOrchestrator()
        persona_config = {
            "name": "User 1",
            "tone": "friendly",
            "goal": "help"
        }
        
        result = await orchestrator.run_simulation(
            agent_id=str(agent_id),
            persona_config=persona_config,
            max_turns=1
        )
        
        assert "messages" in result
        assert len(result["messages"]) >= 2
        assert "report_lines" in result
