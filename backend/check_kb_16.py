import asyncio
from sqlalchemy import select
from database import async_session
from models import KnowledgeItemModel

async def check_kb_16_items():
    async with async_session() as db:
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == 16)
        result = await db.execute(stmt)
        items = result.scalars().all()
        
        print(f"Total de itens na KB 16: {len(items)}")
        for item in items:
            has_emb = item.embedding is not None
            print(f"- Item ID: {item.id} | Q: {item.question[:30]}... | Has Embedding: {has_emb}")

if __name__ == "__main__":
    asyncio.run(check_kb_16_items())
