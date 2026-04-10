from fastapi import APIRouter, Depends, HTTPException
from src.services.orchestrator_service import OrchestratorService
from src.models.schemas import SuccessResponse
from pydantic import BaseModel
from typing import List

router = APIRouter()
orchestrator = OrchestratorService()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    agent_id: str
    messages: List[ChatMessage]

@router.post("/", response_model=SuccessResponse)
async def chat(payload: ChatRequest):
    # Prepare initial state for LangGraph
    initial_state = {
        "messages": [msg.content for msg in payload.messages],
        "agent_id": payload.agent_id,
        "next_node": "router",
        "loop_counter": 0,
        "is_complex": False
    }
    
    try:
        graph = await orchestrator.get_compiled_graph()
        result = await graph.ainvoke(initial_state)
        
        # FR-011: Trigger background persistence
        from src.workers.tasks import persist_checkpoint_task
        await persist_checkpoint_task.kiq({
            "agent_id": payload.agent_id,
            "state": result
        })

        return SuccessResponse(
            data={
                "response": result["messages"][-1],
                "metadata": {
                    "is_complex": result.get("is_complex", False),
                    "used_fallback": result.get("used_fallback", False)
                }
            },
            message="Chat processed successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
