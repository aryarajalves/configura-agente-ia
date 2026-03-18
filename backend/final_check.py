import asyncio
import os
import logging
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Desativar logs do sqlalchemy
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

from database import async_session
from models import AgentConfigModel, KnowledgeItemModel

async def final_check():
    async with async_session() as db:
        # Agent 5
        agent = (await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == 5).options(selectinload(AgentConfigModel.knowledge_bases)))).scalars().first()
        if agent:
            print(f"AGENT_NAME: {agent.name}")
            print(f"KBS_LINKED: {[kb.id for kb in agent.knowledge_bases]}")
            print(f"RAG_SETTINGS: MQ={agent.rag_multi_query_enabled}, Eval={agent.rag_agentic_eval_enabled}, Rerank={agent.rag_rerank_enabled}")
        
        # KB 16 items
        items = (await db.execute(select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == 16))).scalars().all()
        print(f"KB16_COUNT: {len(items)}")
        for it in items:
            has_emb = it.embedding is not None
            print(f"ITEM: {it.id} | EMB: {has_emb} | Q: {it.question}")

if __name__ == "__main__":
    asyncio.run(final_check())
