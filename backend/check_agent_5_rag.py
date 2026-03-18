import asyncio
from sqlalchemy import select
from database import async_session
from models import AgentConfigModel

async def check_agent_5_rag_settings():
    async with async_session() as db:
        stmt = select(AgentConfigModel).where(AgentConfigModel.id == 5)
        result = await db.execute(stmt)
        agent = result.scalars().first()
        
        if not agent:
            print("Agente 5 não encontrado.")
            return
            
        print(f"Agente: {agent.name}")
        print(f"RAG Retrieval Count: {agent.rag_retrieval_count}")
        print(f"RAG Multi-Query: {agent.rag_multi_query_enabled}")
        print(f"RAG Rerank: {agent.rag_rerank_enabled}")
        print(f"RAG Agentic Eval: {agent.rag_agentic_eval_enabled}")
        print(f"RAG Parent Expansion: {agent.rag_parent_expansion_enabled}")
        print(f"System Prompt snippet: {agent.system_prompt[:100]}...")

if __name__ == "__main__":
    asyncio.run(check_agent_5_rag_settings())
