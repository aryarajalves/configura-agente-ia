from pydantic import BaseModel, ConfigDict
from typing import Optional, Any, List
from uuid import UUID
from datetime import datetime

class AgentSchema(BaseModel):
    id: UUID
    name: str
    superadmin_id: UUID
    status: str
    is_locked: bool
    model_fast_id: str
    model_analytic_id: str
    model_fallback_id: Optional[str] = None
    rules_config: dict = {"blacklist": [], "double_check": False}
    routing_thresholds: dict = {}
    
    # UI and specific rule fields (will be populated from rules_config)
    description: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    system_prompt: Optional[str] = None
    context_window: Optional[int] = None
    knowledge_base_ids: Optional[List[int]] = None
    tool_ids: Optional[List[int]] = None
    
    # Security fields
    security_pii_filter: Optional[bool] = None
    security_validator_ia: Optional[bool] = None
    security_bot_protection: Optional[bool] = None
    
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ErrorDetail(BaseModel):
    loc: Optional[List[str]] = None
    msg: str
    type: str

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    code: int
    details: Optional[Any] = None

class SuccessResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
