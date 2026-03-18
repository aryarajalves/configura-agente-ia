import asyncio
from database import async_session
from models import KnowledgeItemModel
from sqlalchemy import select

async def print_kb():
    async with async_session() as db:
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == 16)
        res = await db.execute(stmt)
        for i in res.scalars().all():
            print(f"ID: {i.id}\nQ: {i.question}\nA: {i.answer}\n{'-'*20}")

if __name__ == "__main__":
    asyncio.run(print_kb())
