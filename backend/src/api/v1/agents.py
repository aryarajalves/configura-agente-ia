from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.database import get_db
from src.services.agent_service import AgentService
from src.api.auth import get_superadmin
from src.models.schemas import SuccessResponse, ErrorResponse, AgentSchema
from uuid import UUID
from pydantic import BaseModel
from typing import Optional, List

from typing import Optional, List, Any

router = APIRouter()

def prepare_agent_data(agent: Any) -> dict:
    """Flatten rules_config for the frontend."""
    data = AgentSchema.model_validate(agent).model_dump()
    if hasattr(agent, "rules_config") and isinstance(agent.rules_config, dict):
        for k, v in agent.rules_config.items():
            if k not in data or data[k] is None:
                data[k] = v
    # Map model_fast_id to model
    if "model_fast_id" in data:
        data["model"] = data["model_fast_id"]
    return data

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
    return SuccessResponse(data=[prepare_agent_data(a) for a in agents])

@router.post("", response_model=SuccessResponse)
async def create_agent(
    payload: AgentCreateSchema, 
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    raw = payload.model_dump(exclude_none=True)
    
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=422, detail="Nome do agente é obrigatório")
        
    model = payload.model or payload.model_fast_id
    if not payload.router_enabled and not model:
        raise HTTPException(status_code=422, detail="Modelo é obrigatório quando roteamento está desativado")

    # Map 'model' (frontend field) → 'model_fast_id' (DB column)
    if "model" in raw and not raw.get("model_fast_id"):
        raw["model_fast_id"] = raw.pop("model")
    else:
        raw.pop("model", None)

    # Apply defaults for required DB columns if still missing
    raw.setdefault("model_fast_id", "gpt-4o-mini")
    raw.setdefault("model_analytic_id", raw.get("model_fast_id", "gpt-4o"))

    # Define direct model fields
    AGENT_FIELDS = {
        "name", "superadmin_id", "status", "is_locked",
        "model_fast_id", "model_analytic_id", "model_fallback_id",
        "rules_config", "routing_thresholds",
    }

    # Pack all other fields into rules_config
    agent_data = {k: v for k, v in raw.items() if k in AGENT_FIELDS}
    
    rules_config = raw.get("rules_config", {})
    if not isinstance(rules_config, dict):
        rules_config = {}
    
    # Add floating fields (prompt, temperature, etc) to rules_config
    for key, value in raw.items():
        if key not in AGENT_FIELDS:
            rules_config[key] = value
    
    agent_data["rules_config"] = rules_config
    agent_data["superadmin_id"] = admin["id"]

    agent = await AgentService.create_agent(db, agent_data)
    return SuccessResponse(data=prepare_agent_data(agent), message="Agent created successfully")


@router.get("/{id}", response_model=SuccessResponse)
async def get_agent(id: UUID, db: AsyncSession = Depends(get_db)):
    agent = await AgentService.get_agent(db, id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return SuccessResponse(data=prepare_agent_data(agent))

class AgentUpdateSchema(AgentCreateSchema):
    name: Optional[str] = None

@router.put("/{id}", response_model=SuccessResponse)
async def update_agent(
    id: UUID,
    payload: AgentUpdateSchema,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    raw = payload.model_dump(exclude_unset=True)
    
    if "name" in raw and not raw["name"].strip():
        raise HTTPException(status_code=422, detail="Nome do agente não pode ser vazio")
        
    model = raw.get("model") or raw.get("model_fast_id")
    if not raw.get("router_enabled") and not model and "model" in raw:
        raise HTTPException(status_code=422, detail="Modelo é obrigatório")

    if "model" in raw and not raw.get("model_fast_id"):
        raw["model_fast_id"] = raw.pop("model")
    else:
        raw.pop("model", None)

    AGENT_FIELDS = {
        "name", "superadmin_id", "status", "is_locked",
        "model_fast_id", "model_analytic_id", "model_fallback_id",
        "rules_config", "routing_thresholds",
    }
    
    update_data = {k: v for k, v in raw.items() if k in AGENT_FIELDS}
    
    # Se houver campos que pertencem a rules_config, precisamos garantir que rules_config seja um dicionário
    extra_fields = {k: v for k, v in raw.items() if k not in AGENT_FIELDS}
    if extra_fields:
        rules_config = raw.get("rules_config", {})
        if not isinstance(rules_config, dict):
            rules_config = {}
        for key, value in extra_fields.items():
            rules_config[key] = value
        update_data["rules_config"] = rules_config

    
    agent = await AgentService.update_agent(
        db, 
        id, 
        update_data, 
        requestor_id=admin["id"],
        is_requestor_superadmin=True # Since get_superadmin dependency passed
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    return SuccessResponse(data=prepare_agent_data(agent), message="Agent updated successfully")
