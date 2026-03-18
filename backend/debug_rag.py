
import os
import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
import numpy as np

async def test_rag():
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@db:5432/ai_agent_db"
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    query = "Quais são os tipos de dívidas do cliente"
    
    print(f"Buscando: {query}")
    # 1. Get embedding
    res = await client.embeddings.create(input=[query], model="text-embedding-3-small")
    q_emb = res.data[0].embedding

    async with async_session() as session:
        # 2. Vector Search (using <=> operator for cosine distance)
        # We need to format the vector as a string for PostgreSQL
        v_str = "[" + ",".join(map(str, q_emb)) + "]"
        
        stmt = text("""
            SELECT id, question, 1 - (embedding <=> :v::vector) as similarity
            FROM knowledge_items
            WHERE knowledge_base_id IN (1, 17)
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :v::vector
            LIMIT 5;
        """)
        result = await session.execute(stmt, {"v": v_str})
        items = result.all()
        
        print("\n--- VECTOR SEARCH RESULTS ---")
        for i in items:
            print(f"ID: {i.id} | Sim: {i.similarity:.4f} | Q: {i.question[:50]}...")
            
        # 3. Hybrid search (FTS)
        fts_stmt = text("""
            SELECT id, question, ts_rank_cd(to_tsvector('portuguese', coalesce(question, '') || ' ' || coalesce(answer, '')), websearch_to_tsquery('portuguese', :q)) as rank
            FROM knowledge_items
            WHERE knowledge_base_id IN (1, 17)
              AND to_tsvector('portuguese', coalesce(question, '') || ' ' || coalesce(answer, '')) @@ websearch_to_tsquery('portuguese', :q)
            ORDER BY rank DESC
            LIMIT 5;
        """)
        fts_res = await session.execute(fts_stmt, {"q": query})
        fts_items = fts_res.all()
        
        print("\n--- FTS SEARCH RESULTS ---")
        for i in fts_items:
            print(f"ID: {i.id} | Rank: {i.rank:.4f} | Q: {i.question[:50]}...")

if __name__ == "__main__":
    asyncio.run(test_rag())
