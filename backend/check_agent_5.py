import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import async_session
from models import AgentConfigModel

async def check_agent_5_kbs():
    async with async_session() as db:
        stmt = select(AgentConfigModel).where(AgentConfigModel.id == 5).options(selectinload(AgentConfigModel.knowledge_bases))
        result = await db.execute(stmt)
        agent = result.scalars().first()
        
        if not agent:
            print(f"Agente com ID 5 não encontrado.")
            return
            
        print(f"Agente: {agent.name} (ID: {agent.id})")
        print(f"Bases Vinculadas (M2M):")
        for kb in agent.knowledge_bases:
            print(f"- {kb.name} (ID: {kb.id}, Tipo: {kb.kb_type})")
        
        if agent.knowledge_base_id:
            print(f"Base Legacy FK: {agent.knowledge_base_id}")

if __name__ == "__main__":
    asyncio.run(check_agent_5_kbs())
