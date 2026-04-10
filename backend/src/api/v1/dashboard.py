from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.database import get_db
from src.api.auth import get_owner_or_superadmin
from src.models.agent import Agent, AgentStatus
from src.models.skill import Skill
from src.models.financial_record import FinancialRecord

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_owner_or_superadmin)
):
    # Count active agents
    result_agents = await db.execute(
        select(func.count(Agent.id)).where(Agent.status == AgentStatus.ACTIVE)
    )
    total_agents = result_agents.scalar() or 0

    # Count skills
    result_skills = await db.execute(select(func.count(Skill.id)))
    total_knowledge_bases = result_skills.scalar() or 0

    # Total interactions (placeholder for now if not implemented)
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
