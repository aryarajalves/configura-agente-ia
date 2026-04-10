from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.database import get_db
from src.services.agent_service import AgentService
from src.api.auth import get_superadmin
from src.models.schemas import SuccessResponse, ErrorResponse, AgentSchema
from uuid import UUID
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class AgentCreateSchema(BaseModel):
    name: str
    # Accept both legacy (model_fast_id) and frontend (model) field names
    model: Optional[str] = None
    model_fast_id: Optional[str] = None
    model_analytic_id: Optional[str] = None
    model_fallback_id: Optional[str] = None
    # Extended config fields passed by ConfigPanel (all optional)
    description: Optional[str] = None
    fallback_model: Optional[str] = None
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = 1.0
    date_awareness: Optional[bool] = False
    system_prompt: Optional[str] = ""
    context_window: Optional[int] = 5
    knowledge_base_ids: Optional[List] = None
    rag_retrieval_count: Optional[int] = 5
    rag_translation_enabled: Optional[bool] = False
    rag_multi_query_enabled: Optional[bool] = False
    rag_rerank_enabled: Optional[bool] = True
    rag_agentic_eval_enabled: Optional[bool] = True
    rag_parent_expansion_enabled: Optional[bool] = True
    inbox_capture_enabled: Optional[bool] = True
    tool_ids: Optional[List] = None
    simulated_time: Optional[str] = None
    router_enabled: Optional[bool] = False
    router_simple_model: Optional[str] = None
    router_simple_fallback_model: Optional[str] = None
    router_complex_model: Optional[str] = None
    router_complex_fallback_model: Optional[str] = None
    handoff_enabled: Optional[bool] = False
    response_translation_enabled: Optional[bool] = False
    response_translation_fallback_lang: Optional[str] = "portuguese"
    top_k: Optional[int] = 40
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0
    safety_settings: Optional[str] = "standard"
    reasoning_effort: Optional[str] = "medium"
    model_settings: Optional[dict] = None
    security_competitor_blacklist: Optional[str] = None
    security_forbidden_topics: Optional[str] = None
    security_discount_policy: Optional[str] = None
    security_language_complexity: Optional[str] = "standard"
    security_pii_filter: Optional[bool] = False
    security_validator_ia: Optional[bool] = False
    security_bot_protection: Optional[bool] = False
    security_max_messages_per_session: Optional[int] = 20
    security_semantic_threshold: Optional[float] = 0.85
    security_loop_count: Optional[int] = 3
    ui_primary_color: Optional[str] = "#6366f1"
    ui_header_color: Optional[str] = "#0f172a"
    ui_chat_title: Optional[str] = "Suporte Inteligente"
    ui_welcome_message: Optional[str] = "Olá! Como posso te ajudar hoje?"

@router.get("", response_model=SuccessResponse)
async def list_agents(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    agents = await AgentService.list_agents(db, superadmin_id=admin["id"])
    return SuccessResponse(data=[AgentSchema.model_validate(a) for a in agents])

@router.post("", response_model=SuccessResponse)
async def create_agent(
    payload: AgentCreateSchema, 
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    raw = payload.model_dump(exclude_none=True)

    # Map 'model' (frontend field) → 'model_fast_id' (DB column)
    if "model" in raw and not raw.get("model_fast_id"):
        raw["model_fast_id"] = raw.pop("model")
    else:
        raw.pop("model", None)

    # Apply defaults for required DB columns if still missing
    raw.setdefault("model_fast_id", "gpt-4o-mini")
    raw.setdefault("model_analytic_id", raw.get("model_fast_id", "gpt-4o"))

    # Only pass fields that exist on the Agent model to avoid unexpected-keyword errors
    AGENT_FIELDS = {
        "name", "superadmin_id", "status", "is_locked",
        "model_fast_id", "model_analytic_id", "model_fallback_id",
        "rules_config", "routing_thresholds",
    }
    agent_data = {k: v for k, v in raw.items() if k in AGENT_FIELDS}
    agent_data["superadmin_id"] = admin["id"]

    agent = await AgentService.create_agent(db, agent_data)
    return SuccessResponse(data=AgentSchema.model_validate(agent), message="Agent created successfully")


@router.get("/{id}", response_model=SuccessResponse)
async def get_agent(id: UUID, db: AsyncSession = Depends(get_db)):
    agent = await AgentService.get_agent(db, id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return SuccessResponse(data=AgentSchema.model_validate(agent))

class AgentUpdateSchema(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    is_locked: Optional[bool] = None
    model_fast_id: Optional[str] = None
    model_analytic_id: Optional[str] = None
    model_fallback_id: Optional[str] = None
    rules_config: Optional[dict] = None

@router.put("/{id}", response_model=SuccessResponse)
async def update_agent(
    id: UUID,
    payload: AgentUpdateSchema,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    update_data = payload.model_dump(exclude_unset=True)
    
    agent = await AgentService.update_agent(
        db, 
        id, 
        update_data, 
        requestor_id=admin["id"],
        is_requestor_superadmin=True # Since get_superadmin dependency passed
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    return SuccessResponse(data=AgentSchema.model_validate(agent), message="Agent updated successfully")
