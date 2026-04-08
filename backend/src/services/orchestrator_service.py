import logging
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from backend.src.database import DATABASE_URL

logger = logging.getLogger(__name__)

# Define the state for the orchestrator
class AgentState(TypedDict):
    messages: Annotated[list, "History of messages"]
    next_node: str
    loop_counter: int
    agent_id: str
    is_complex: bool
    security_flag: bool
    used_fallback: bool

class OrchestratorService:
    def __init__(self):
        self.builder = StateGraph(AgentState)
        self._setup_graph()

    def _setup_graph(self):
        # Define nodes
        self.builder.add_node("router", self.route_decision)
        self.builder.add_node("fast_brain", self.call_fast_brain)
        self.builder.add_node("analytic_brain", self.call_analytic_brain)
        self.builder.add_node("security", self.security_guard)
        
        # Define edges
        self.builder.set_entry_point("router")
        self.builder.add_conditional_edges(
            "router",
            lambda x: x["next_node"],
            {
                "fast": "fast_brain",
                "analytic": "analytic_brain",
                "END": END
            }
        )
        self.builder.add_edge("fast_brain", "security")
        self.builder.add_edge("analytic_brain", "security")
        self.builder.add_edge("security", END)

    async def route_decision(self, state: AgentState):
        from backend.src.services.agent_service import AgentService
        from backend.src.models.agent import AgentStatus
        from backend.src.database import AsyncSessionLocal
        from uuid import UUID

        agent_id = state.get("agent_id")
        loop_count = state.get("loop_counter", 0) + 1
        
        # FR-015: Loop detection (Max 3 cycles)
        if loop_count > 3:
            logger.warning(f"Loop detected for agent {agent_id}. Terminating flow.")
            return {"next_node": "END", "loop_counter": loop_count}

        async with AsyncSessionLocal() as db:
            agent = await AgentService.get_agent(db, UUID(agent_id))
            
            if not agent or agent.status != AgentStatus.ACTIVE:
                # FR-016 Stop processing if not ACTIVE
                raise Exception("Agent is not active or not found")

            # Basic complexity logic
            last_message = state["messages"][-1] if state["messages"] else ""
            is_complex = len(last_message) > 100 
            
            # Check for forced analytic keywords (FR-002a)
            analytic_keywords = agent.routing_thresholds.get("analytic_keywords", [])
            if any(kw in last_message.lower() for kw in analytic_keywords):
                is_complex = True
            
            next_node = "analytic" if is_complex else "fast"
            
            return {
                "next_node": next_node, 
                "is_complex": is_complex, 
                "loop_counter": loop_count
            }

    async def security_guard(self, state: AgentState):
        from backend.src.services.security_service import SecurityService
        from backend.src.services.agent_service import AgentService
        from backend.src.database import AsyncSessionLocal
        from uuid import UUID

        agent_id = state.get("agent_id")
        last_message = state["messages"][-1]

        async with AsyncSessionLocal() as db:
            agent = await AgentService.get_agent(db, UUID(agent_id))
            rules = agent.rules_config if agent else {"blacklist": [], "double_check": False}

        # 1. Blacklist Check
        if SecurityService.check_blacklist(last_message, rules.get("blacklist", [])):
            return {"messages": state["messages"][:-1] + ["Message blocked by security policy."], "security_flag": True}

        # 2. Double Check IA (if enabled)
        if rules.get("double_check"):
            checked_message = await SecurityService.double_check_ai(last_message, rules)
            if checked_message != last_message:
                return {"messages": state["messages"][:-1] + [checked_message], "security_flag": True}

        return {"messages": state["messages"], "security_flag": False}

    async def call_fast_brain(self, state: AgentState):
        from backend.src.services.llm_service import llm_service
        from backend.src.services.agent_service import AgentService
        from backend.src.database import AsyncSessionLocal
        from uuid import UUID
        import asyncio

        agent_id = state.get("agent_id")
        async with AsyncSessionLocal() as db:
            agent = await AgentService.get_agent(db, UUID(agent_id))
            model_id = agent.model_fast_id if agent else "gpt-3.5-turbo"
            fallback_id = agent.model_fallback_id if agent else None

        try:
            response = await asyncio.wait_for(
                llm_service.call_model(model_id, state["messages"], timeout=8),
                timeout=8.5
            )
            return {"messages": state["messages"] + [response], "used_fallback": False}
        except (asyncio.TimeoutError, Exception) as e:
            logger.error(f"Fast brain failed: {e}. Trying fallback...")
            if fallback_id:
                response = await llm_service.call_model(fallback_id, state["messages"])
                return {"messages": state["messages"] + [response], "used_fallback": True}
            raise

    async def call_analytic_brain(self, state: AgentState):
        from backend.src.services.llm_service import llm_service
        from backend.src.services.agent_service import AgentService
        from backend.src.database import AsyncSessionLocal
        from uuid import UUID
        import asyncio

        agent_id = state.get("agent_id")
        async with AsyncSessionLocal() as db:
            agent = await AgentService.get_agent(db, UUID(agent_id))
            model_id = agent.model_analytic_id if agent else "gpt-4"
            fallback_id = agent.model_fallback_id if agent else None

        try:
            response = await asyncio.wait_for(
                llm_service.call_model(model_id, state["messages"], timeout=8),
                timeout=8.5
            )
            return {"messages": state["messages"] + [response], "used_fallback": False}
        except (asyncio.TimeoutError, Exception) as e:
            logger.error(f"Analytic brain failed: {e}. Trying fallback...")
            if fallback_id:
                response = await llm_service.call_model(fallback_id, state["messages"])
                return {"messages": state["messages"] + [response], "used_fallback": True}
            raise

    async def get_compiled_graph(self, pool=None):
        return self.builder.compile()
