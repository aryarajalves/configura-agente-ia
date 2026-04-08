from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.src.database import get_db
from backend.src.services.agent_service import AgentService
from backend.src.api.auth import get_superadmin
from backend.src.models.schemas import SuccessResponse, ErrorResponse, AgentSchema
from uuid import UUID
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class AgentCreateSchema(BaseModel):
    name: str
    model_fast_id: str
    model_analytic_id: str
    model_fallback_id: Optional[str] = None

@router.post("/", response_model=SuccessResponse)
async def create_agent(
    payload: AgentCreateSchema, 
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    agent_data = payload.model_dump()
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
