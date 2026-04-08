import asyncio
from sqlalchemy import select, func
from database import SessionLocal
from models import KnowledgeItemModel

async def check_embeddings():
    async with SessionLocal() as db:
        total_stmt = select(func.count(KnowledgeItemModel.id))
        total_res = await db.execute(total_stmt)
        total = total_res.scalar()
        
        with_emb_stmt = select(func.count(KnowledgeItemModel.id)).where(KnowledgeItemModel.embedding.is_not(None))
        with_emb_res = await db.execute(with_emb_stmt)
        with_emb = with_emb_res.scalar()
        
        print(f"Total de itens: {total}")
        print(f"Itens com embedding: {with_emb}")
        print(f"Itens sem embedding: {total - with_emb}")

if __name__ == "__main__":
    asyncio.run(check_embeddings())
