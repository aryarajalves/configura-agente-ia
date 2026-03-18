
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select

import sys
sys.path.append("/app")

async def test_specific_rag():
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@db:5432/ai_agent_db"
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from rag_service import search_knowledge_base
    from models import AgentConfigModel

    # Query exactly as in the screenshot
    query = "como interpretar as categorias da matriz?"
    agent_id = 5
    
    async with async_session() as session:
        res = await session.execute(
            select(AgentConfigModel)
            .where(AgentConfigModel.id == agent_id)
            .options(selectinload(AgentConfigModel.knowledge_bases))
        )
        agent = res.scalar_one()
        kb_ids = [kb.id for kb in agent.knowledge_bases]
        
        print(f"DEBUG: Agent {agent_id} KBs: {kb_ids}")
        print(f"DEBUG: Query: {query}")
        
        relevant_items, usage = await search_knowledge_base(
            db=session,
            query=query,
            kb_ids=kb_ids,
            limit=agent.rag_retrieval_count,
            model=agent.router_simple_model or "gpt-4o-mini",
            fallback_model=agent.router_simple_fallback_model or "gpt-4o-mini"
        )
        
        print(f"\nFinal Result: Items found: {len(relevant_items)}")
        for i in relevant_items:
            print(f"ID: {i.get('id')} | Q: {i.get('question')[:70]}...")

if __name__ == "__main__":
    asyncio.run(test_specific_rag())
