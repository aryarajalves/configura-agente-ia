import asyncio
from sqlalchemy import select
from database import async_session
from models import AgentConfigModel

async def list_all_agents_kbs():
    async with async_session() as db:
        from sqlalchemy.orm import selectinload
        stmt = select(AgentConfigModel).options(selectinload(AgentConfigModel.knowledge_bases))
        result = await db.execute(stmt)
        agents = result.scalars().all()
        
        for agent in agents:
            print(f"Agente: {agent.name} (ID: {agent.id})")
            print(f"  Bases (M2M): {[f'{kb.name} ({kb.id})' for kb in agent.knowledge_bases]}")
            print(f"  Base Legacy: {agent.knowledge_base_id}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(list_all_agents_kbs())
