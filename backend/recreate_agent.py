
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5433/ai_agent_db"

async def recreate_agent():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text("""
            INSERT INTO agent_config (name, description, model, system_prompt, is_active) 
            VALUES ('Agente Especialista', 'Agente configurado para automação e suporte.', 'gemini-1.5-pro', 'Você é um assistente prestativo e especialista em automação comercial.', true)
        """))
    print("✅ Agente recriado com sucesso no banco de dados!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(recreate_agent())
