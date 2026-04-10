from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from src.database import get_db
from src.services.auth_service import AuthService
from src.api.auth import get_superadmin
from src.models.schemas import SuccessResponse
from pydantic import BaseModel
from typing import Optional, Any
from sqlalchemy import select, func

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await AuthService.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    token = AuthService.create_access_token({"id": str(user.id), "email": user.email, "role": user.role})
    
    # Set persistent HttpOnly cookie (30 days = 2592000 seconds)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 30,  # 30 days
        samesite="lax",
        secure=False,  # Set True in production behind HTTPS
    )
    
    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": getattr(user, "name", "Admin"),
            "role": user.role
        }
    }

@router.get("/users/me", response_model=SuccessResponse)
async def get_me(admin: dict = Depends(get_superadmin)):
    """Return current authenticated user info."""
    return SuccessResponse(data={
        "id": admin["id"],
        "email": admin["email"],
        "name": admin.get("name", "Admin"),
        "role": admin["role"]
    })

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

@router.put("/users/me", response_model=SuccessResponse)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin)
):
    """Update current user profile."""
    updated = await AuthService.update_admin(db, admin["id"], payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return SuccessResponse(
        data={
            "id": str(updated.id),
            "email": updated.email,
            "name": updated.name,
            "role": updated.role
        },
        message="Perfil atualizado com sucesso!"
    )

from src.models.agent import Agent, AgentStatus
from src.models.skill import Skill
from src.models.financial_record import FinancialRecord

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db)
):
    """Return high-level dashboard metrics."""
    # Count active agents
    result_agents = await db.execute(
        select(func.count(Agent.id)).where(Agent.status == AgentStatus.ACTIVE)
    )
    total_agents = result_agents.scalar() or 0

    # Count skills
    result_skills = await db.execute(select(func.count(Skill.id)))
    total_knowledge_bases = result_skills.scalar() or 0

    # Total interactions (placeholder)
    total_interactions = 0

    # Sum estimated cost
    result_cost = await db.execute(select(func.sum(FinancialRecord.estimated_cost)))
    total_cost = float(result_cost.scalar() or 0.0)

    return {
        "total_agents": total_agents,
        "total_knowledge_bases": total_knowledge_bases,
        "total_interactions": total_interactions,
        "total_cost": total_cost,
    }

@router.get("/global-variables", response_model=SuccessResponse)
async def list_global_variables(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_superadmin),
):
    """US2 Placeholder for global context variables."""
    return SuccessResponse(data=[], message="Variables loaded")
