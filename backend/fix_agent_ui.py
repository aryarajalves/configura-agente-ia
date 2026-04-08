
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5433/ai_agent_db"

async def fix_agent():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # Atualiza para o modelo mais recente seguindo a skill e garante os campos UI básicos
        await conn.execute(text("""
            UPDATE agent_config 
            SET model = 'gemini-3.1-pro',
                is_active = true,
                ui_primary_color = '#6366f1',
                ui_header_color = 'rgba(30, 41, 59, 0.9)',
                ui_chat_title = 'Especialista em Automação'
            WHERE id = 1
        """))
    print("✅ Agente atualizado com o modelo gemini-3.1-pro e campos UI!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_agent())
