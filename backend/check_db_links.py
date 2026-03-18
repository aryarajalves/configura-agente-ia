
import asyncio
from sqlalchemy import select, text
from database import async_session
from models import AgentConfigModel, KnowledgeBaseModel

async def check_links():
    async with async_session() as session:
        # Check for agents linked via legacy field
        stmt = select(AgentConfigModel).where(AgentConfigModel.knowledge_base_id.isnot(None))
        res = await session.execute(stmt)
        agents = res.scalars().all()
        print(f"Agents with legacy KB link: {len(agents)}")
        for a in agents:
            print(f" - Agent ID: {a.id}, Name: {a.name}, KB ID: {a.knowledge_base_id}")

        # Check if those KB IDs exist
        if agents:
            kb_ids = [a.knowledge_base_id for a in agents]
            stmt_kb = select(KnowledgeBaseModel).where(KnowledgeBaseModel.id.in_(kb_ids))
            res_kb = await session.execute(stmt_kb)
            kbs = res_kb.scalars().all()
            print(f"Found {len(kbs)} corresponding Knowledge Bases")
            for kb in kbs:
                print(f" - KB ID: {kb.id}, Name: {kb.name}")

if __name__ == "__main__":
    asyncio.run(check_links())
