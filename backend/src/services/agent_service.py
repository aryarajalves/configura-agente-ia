from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.src.models.agent import Agent, AgentStatus
from uuid import UUID
from typing import List, Optional

class AgentService:
    @staticmethod
    async def create_agent(db: AsyncSession, agent_data: dict) -> Agent:
        new_agent = Agent(**agent_data)
        db.add(new_agent)
        await db.commit()
        await db.refresh(new_agent)
        return new_agent

    @staticmethod
    async def get_agent(db: AsyncSession, agent_id: UUID) -> Optional[Agent]:
        result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.deleted_at == None))
        return result.scalars().first()

    @staticmethod
    async def list_agents(db: AsyncSession, superadmin_id: Optional[UUID] = None) -> List[Agent]:
        query = select(Agent).where(Agent.deleted_at == None)
        if superadmin_id:
            query = query.where(Agent.superadmin_id == superadmin_id)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_agent(
        db: AsyncSession, 
        agent_id: UUID, 
        update_data: dict,
        requestor_id: UUID,
        is_requestor_superadmin: bool = False
    ) -> Optional[Agent]:
        agent = await AgentService.get_agent(db, agent_id)
        if not agent:
            return None
        
        # US2 / FR-005: Global Edit Lock Logic
        if agent.is_locked:
            # Only the creator (Owner) can edit a locked agent
            if not (is_requestor_superadmin and str(agent.superadmin_id) == str(requestor_id)):
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=403, 
                    detail="Agent is locked for global editing. Only its owner can modify it."
                )
        
        # FR-010: Audit Log registration
        from backend.src.models.audit import AuditLog
        import json

        try:
            # Ensure IDs are UUID objects
            if isinstance(requestor_id, str):
                requestor_id = UUID(requestor_id)
            if isinstance(agent_id, str):
                agent_id = UUID(agent_id)

            # Capture previous state
            previous_state = {key: str(getattr(agent, key)) if hasattr(agent, key) else None for key in update_data.keys()}
            
            for key, value in update_data.items():
                if hasattr(agent, key):
                    setattr(agent, key, value)
            
            # Create audit entry
            audit_entry = AuditLog(
                agent_id=agent.id,
                superadmin_id=requestor_id,
                action="UPDATE_AGENT",
                previous_state=previous_state,
                new_state=update_data
            )
            db.add(audit_entry)
            
            await db.commit()
            await db.refresh(agent)
            return agent
        except Exception as e:
            import traceback
            print(f"[ERROR] Service Update Crash: {e}")
            traceback.print_exc()
            raise e
