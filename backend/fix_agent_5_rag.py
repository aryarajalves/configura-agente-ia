import asyncio
from database import async_session
from models import AgentConfigModel
from sqlalchemy import update

async def fix_agent_5():
    async with async_session() as db:
        stmt = update(AgentConfigModel).where(AgentConfigModel.id == 5).values(
            rag_multi_query_enabled=True,
            rag_retrieval_count=8 # Aumentar para ter mais chances de pegar o produto correto
        )
        await db.execute(stmt)
        await db.commit()
        print("Agente 5 atualizado: MQ=True, Limit=8")

if __name__ == "__main__":
    asyncio.run(fix_agent_5())
