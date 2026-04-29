import asyncio
import os
import sys

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

sys.path.append("/app")
from rag_service import get_embedding
from sqlalchemy import select
from models import KnowledgeItemModel

async def main():
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/ai_agent_db")
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        query = "Quais são os tipos de dividas do cliente"
        q_emb, _ = await get_embedding(query)
        
        dist_col = KnowledgeItemModel.embedding.cosine_distance(q_emb).label("dist")
        stmt = select(KnowledgeItemModel.id, KnowledgeItemModel.question, dist_col).where(
            KnowledgeItemModel.knowledge_base_id == 17
        ).order_by(dist_col).limit(10)
        
        res = await db.execute(stmt)
        print("TOP 10 MAIS PROXIMOS POR VECTOR DISTANCE NO PGVECTOR DA KB 17:")
        for r in res.all():
            print(f"ID={r.id} | DIST={r.dist:.4f} | Q={r.question[:50]}")
            
if __name__ == "__main__":
    asyncio.run(main())
