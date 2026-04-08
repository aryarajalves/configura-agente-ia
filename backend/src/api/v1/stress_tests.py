from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.src.database import get_db
from backend.src.services.stress_test_service import StressTestService
from backend.src.api.auth import get_superadmin, get_current_user
from backend.src.models.schemas import SuccessResponse, ErrorResponse
from backend.src.models.stress_test import StressTestStatus
from uuid import UUID
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

router = APIRouter()

class PersonaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    behavior_config: Dict[str, Any]

class StressTestSessionCreate(BaseModel):
    persona_id: UUID

@router.post("/personas", response_model=SuccessResponse)
async def create_persona(
    payload: PersonaCreate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    service = StressTestService(db)
    persona = await service.create_persona(
        name=payload.name,
        behavior_config=payload.behavior_config,
        description=payload.description
    )
    return SuccessResponse(data={"id": str(persona.id)}, message="Persona created successfully")

@router.get("/personas", response_model=SuccessResponse)
async def list_personas(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_user)
):
    service = StressTestService(db)
    personas = await service.list_personas()
    return SuccessResponse(data=[{"id": str(p.id), "name": p.name} for p in personas])

@router.post("/", response_model=SuccessResponse)
async def start_stress_test(
    payload: StressTestSessionCreate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    service = StressTestService(db)
    session = await service.create_session(
        persona_id=payload.persona_id,
        created_by=UUID(admin["id"])
    )
    await service.submit_stress_test_task(session.id)
    return SuccessResponse(data={"id": str(session.id)}, message="Stress test session started")

@router.get("/{stress_test_id}", response_model=SuccessResponse)
async def get_stress_test_status(
    stress_test_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_user)
):
    service = StressTestService(db)
    session = await service.get_session(stress_test_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SuccessResponse(data={
        "id": str(session.id),
        "status": session.status,
        "progress": session.progress_percentage,
        "error_message": session.error_message
    })

@router.get("/{stress_test_id}/report", response_model=SuccessResponse)
async def get_stress_test_report(
    stress_test_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_current_user)
):
    service = StressTestService(db)
    session = await service.get_session(stress_test_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SuccessResponse(data={
        "relatorio_md_link": session.relatorio_md_link
    })
