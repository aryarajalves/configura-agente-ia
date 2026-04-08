import asyncio
from sqlalchemy import select
from database import async_session
from models import KnowledgeBaseModel

async def list_kbs():
    async with async_session() as db:
        stmt = select(KnowledgeBaseModel)
        result = await db.execute(stmt)
        kbs = result.scalars().all()
        for kb in kbs:
            print(f"ID: {kb.id} | Nome: {kb.name} | Tipo: {kb.kb_type}")

if __name__ == "__main__":
    asyncio.run(list_kbs())
