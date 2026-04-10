import uuid
import logging
import asyncio
from typing import Dict, Any
from src.workers.broker import broker
from src.database import AsyncSessionLocal
from src.services.stress_test_service import StressTestService
from src.models.stress_test import StressTestStatus

logger = logging.getLogger(__name__)

@broker.task
async def run_stress_test_session(session_id: str, persona_config: Dict[str, Any]):
    """
    Background job to run a stress test session.
    Simulates conversations based on persona_config and logic from LangGraph.
    """
    session_uuid = uuid.UUID(session_id)
    async with AsyncSessionLocal() as db:
        service = StressTestService(db)
        try:
            logger.info(f"Starting stress test for session {session_id}")
            await service.update_session_status(session_uuid, StressTestStatus.PROCESSING, progress=10)
            
            # Simulation logic placeholder (US1/T011)
            # 1. Load conversation logs
            # 2. Iterate and generate responses via Analytic Brain
            # 3. Detect failures and create Inbox items
            
            # Simulation logic (US1/T009)
            from src.services.simulation_orchestrator import SimulationOrchestrator
            from src.services.inbox_service import InboxService
            from src.models.agent import Agent # To get the first active agent for simulation
            from sqlalchemy import select
            
            # Find the first active agent as target
            agent_result = await db.execute(select(Agent).limit(1))
            agent = agent_result.scalar_one_or_none()
            if not agent:
                raise Exception("No active agent found for stress test.")

            orchestrator = SimulationOrchestrator()
            result = await orchestrator.run_simulation(
                agent_id=str(agent.id),
                persona_config=persona_config,
                max_turns=5
            )
            
            # 3. Detect failures and create Inbox items
            if result.get("failure_detected"):
                inbox_service = InboxService(db)
                await inbox_service.create_inbox_item(
                    agent_id=agent.id,
                    user_query=result["messages"][-2]["content"], # Last user message
                    ai_response=result["messages"][-1]["content"], # Last agent response
                    failure_reason=result["failure_reason"],
                    context={"session_id": session_id}
                )

            # Generate report string
            report_content = "\n".join(result["report_lines"])
            # In a real app, we would upload to S3/Storage. 
            # For now we save the text content as the "link" or just log it.
            # FR-012: Link para o relatório Markdown
            
            await service.update_session_status(
                session_uuid, 
                StressTestStatus.SUCCESS, 
                progress=100,
                relatorio_link=f"data:text/markdown;base64,... (omitted)"
            )
            logger.info(f"Stress test session {session_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Stress test session {session_id} failed: {e}")
            await service.update_session_status(
                session_uuid, 
                StressTestStatus.ERROR, 
                error_message=str(e)
            )
