import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Adicionar o path para importar os modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from database import Base, get_db
from models import AgentConfigModel

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@db:5432/ai_agent_db"

async def fix_agent_insertion():
    # 1. Conectar ao banco
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 2. Deletar os agentes quebrados
        from sqlalchemy import text
        await session.execute(text("DELETE FROM agent_config"))
        await session.commit()
        
        # 3. Criar um novo usando o modelo oficial (que preenche defaults)
        new_agent = AgentConfigModel(
            name="Antigravity Master",
            description="Agente Criado via Script Seguro",
            model="gemini-1.5-pro",
            system_prompt="Você é um assistente proativo e especialista em automação.",
            is_active=True,
            # Garantir que campos JSON estão com strings válidas
            knowledge_base="[]",
            model_settings="{}"
        )
        
        session.add(new_agent)
        await session.commit()
        print(f"✅ Agente '{new_agent.name}' criado com sucesso através do SQLAlchemy!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_agent_insertion())
