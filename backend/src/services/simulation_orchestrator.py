import logging
from typing import Annotated, TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)

class SimulationState(TypedDict):
    messages: Annotated[List[Dict[str, str]], "Conversation history"]
    persona_config: Dict[str, Any]
    agent_id: str
    current_turn: int
    max_turns: int
    failure_detected: bool
    failure_reason: Optional[str]
    report_lines: List[str]

class SimulationOrchestrator:
    def __init__(self):
        self.builder = StateGraph(SimulationState)
        self._setup_graph()

    def _setup_graph(self):
        self.builder.add_node("persona_turn", self.call_persona)
        self.builder.add_node("agent_turn", self.call_agent)
        self.builder.add_node("evaluator", self.evaluate_interaction)

        self.builder.set_entry_point("persona_turn")
        
        self.builder.add_edge("persona_turn", "agent_turn")
        self.builder.add_edge("agent_turn", "evaluator")
        
        self.builder.add_conditional_edges(
            "evaluator",
            self.should_continue,
            {
                "continue": "persona_turn",
                "end": END
            }
        )

    async def call_persona(self, state: SimulationState):
        from src.services.llm_service import llm_service
        
        messages = state["messages"]
        persona_config = state["persona_config"]
        
        system_prompt = f"""
        Você é um usuário simulado com o seguinte perfil:
        Nome: {persona_config.get('name', 'Usuário')}
        Comportamento: {persona_config.get('tone', 'neutro')}
        Objetivo: {persona_config.get('goal', 'tirar dúvidas')}
        
        Mantenha a conversa realista e focada em testar os limites do assistente.
        """
        
        combined_messages = [{"role": "system", "content": system_prompt}] + messages
        response = await llm_service.call_model("gpt-3.5-turbo", combined_messages)
        
        new_messages = messages + [{"role": "user", "content": response}]
        return {
            "messages": new_messages,
            "current_turn": state["current_turn"] + 1,
            "report_lines": state["report_lines"] + [f"USER: {response}"]
        }

    async def call_agent(self, state: SimulationState):
        from src.services.orchestrator_service import OrchestratorService
        
        orchestrator = OrchestratorService()
        compiled = await orchestrator.get_compiled_graph()
        
        # Prepare state for real agent orchestrator
        agent_state = {
            "messages": [m["content"] for m in state["messages"]],
            "agent_id": state["agent_id"],
            "loop_counter": 0,
            "used_fallback": False,
            "is_complex": False,
            "security_flag": False
        }
        
        result = await compiled.ainvoke(agent_state)
        agent_response = result["messages"][-1]
        
        new_messages = state["messages"] + [{"role": "assistant", "content": agent_response}]
        return {
            "messages": new_messages,
            "report_lines": state["report_lines"] + [f"AGENT: {agent_response}"]
        }

    async def evaluate_interaction(self, state: SimulationState):
        from src.services.llm_service import llm_service
        
        last_agent_msg = state["messages"][-1]["content"] if state["messages"] else ""
        
        eval_prompt = f"""
        Analise a resposta do assistente abaixo e determine se houve uma falha de atendimento 
        (respostas incoerentes, grossas, evasivas ou erros factuais).
        
        Resposta: {last_agent_msg}
        
        Responda APENAS 'FALHA' ou 'OK'. Se for falha, adicione o motivo após um pipe.
        Exemplo: FALHA|O assistente foi agressivo
        """
        
        eval_result = await llm_service.call_model("gpt-3.5-turbo", [{"role": "user", "content": eval_prompt}])
        
        failure = "FALHA" in eval_result
        reason = eval_result.split("|")[1] if "|" in eval_result else None
        
        report_update = []
        if failure:
            report_update = [f"⚠️ CRÍTICA: {reason}"]
            
        return {
            "failure_detected": failure or state["failure_detected"],
            "failure_reason": reason if failure else state["failure_reason"],
            "report_lines": state["report_lines"] + report_update
        }

    def should_continue(self, state: SimulationState):
        if state["current_turn"] >= state["max_turns"] or state["failure_detected"]:
            return "end"
        return "continue"

    async def run_simulation(self, agent_id: str, persona_config: Dict[str, Any], max_turns: int = 5):
        initial_state = {
            "messages": [],
            "persona_config": persona_config,
            "agent_id": agent_id,
            "current_turn": 0,
            "max_turns": max_turns,
            "failure_detected": False,
            "failure_reason": None,
            "report_lines": [f"# Relatório de Simulação - Persona: {persona_config.get('name')}"]
        }
        
        compiled = self.builder.compile()
        return await compiled.ainvoke(initial_state)
