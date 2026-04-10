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
