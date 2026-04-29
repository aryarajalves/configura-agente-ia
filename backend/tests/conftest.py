import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
import os
import sys
from dotenv import load_dotenv

# Carrega as variáveis do .env na raiz do projeto
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env')))

os.environ["TESTING"] = "true"

# Adiciona o diretório backend ao path para conseguir importar os módulos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Fallback para DATABASE_URL caso não esteja no .env
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://admin_agente:admin_agente_pwd_123@localhost:5433/rag_db"

from main import app
from database import get_db, Base
import database
# Desabilita o init_db global durante os testes para evitar conflitos de event loop
database.init_db = lambda: asyncio.sleep(0) # Retorna uma corotina vazia
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

# Mock da base de dados para testes
# Em um ambiente de produção/CI, você usaria um banco de dados de teste separado
# Para simplificar aqui, vamos usar o banco atual ou um banco de teste se configurado

# No longer needed with asyncio_mode = auto and proper pytest.ini configuration

@pytest.fixture
async def db_engine():
    # Eliminamos o uso do init_db global que usa o motor global poluindo os loops
    test_engine = create_async_engine(DATABASE_URL)
    # Criamos as tabelas diretamente com o motor de teste
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()

@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator:
    test_session_maker = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with test_session_maker() as session:
        yield session
        # Limpeza após o teste para evitar UniqueViolation em execuções repetidas
        await session.rollback()
        # Opcional: Para uma limpeza agressiva entre testes:
        # for table in reversed(Base.metadata.sorted_tables):
        #     await session.execute(table.delete())
        # await session.commit()

@pytest.fixture
async def client(db_session) -> AsyncGenerator:
    # Sobrescreve a dependência get_db do FastAPI
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    
    # Adicionar API Key mockada se necessário para os testes
    headers = {"X-API-Key": os.getenv("AGENT_API_KEY", "test-api-key")}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=headers) as ac:
        yield ac
    
    app.dependency_overrides.clear()
