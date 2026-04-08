import asyncio
from sqlalchemy import select
from database import async_session
from models import AgentConfigModel, KnowledgeBaseModel

async def check_agent_kbs(agent_name: str):
    async with async_session() as db:
        stmt = select(AgentConfigModel).where(AgentConfigModel.name == agent_name)
        from sqlalchemy.orm import selectinload
        stmt = stmt.options(selectinload(AgentConfigModel.knowledge_bases))
        result = await db.execute(stmt)
        agent = result.scalars().first()
        
        if not agent:
            print(f"Agente '{agent_name}' não encontrado.")
            return
            
        print(f"Agente: {agent.name} (ID: {agent.id})")
        print(f"Bases Vinculadas (M2M):")
        for kb in agent.knowledge_bases:
            print(f"- {kb.name} (ID: {kb.id}, Tipo: {kb.kb_type})")
            
        if agent.knowledge_base_id:
            kb_single_stmt = select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == agent.knowledge_base_id)
            kb_single_res = await db.execute(kb_single_stmt)
            kb_single = kb_single_res.scalars().first()
            if kb_single:
                print(f"Base Vinculada (Legacy FK): {kb_single.name} (ID: {kb_single.id})")

if __name__ == "__main__":
    asyncio.run(check_agent_kbs("Agente - Eneagrama"))
