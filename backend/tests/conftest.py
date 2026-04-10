import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
import os
import sys
from dotenv import load_dotenv

# Force TESTING mode
os.environ["TESTING"] = "true"

# Load .env
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(env_path)

# OVERRIDE critical variables for tests to avoid socket.gaierror
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_db.sqlite"
os.environ["RABBIT_URL"] = "memory://" # TaskIQ support memory broker for tests
os.environ["RABBITMQ_URL"] = "memory://"
os.environ["AGENT_API_KEY"] = "test-api-key"

# Add directories to path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, PROJECT_ROOT)

from src.main import app
from src.database import get_db, Base
from src.models.admin import Admin
from src.models.agent import Agent
from src.models.audit import AuditLog
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

@pytest.fixture
async def db_engine():
    # Use SQLite for tests
    test_engine = create_async_engine(os.environ["DATABASE_URL"])
    
    print(f"\n[DEBUG] Tables registered in metadata: {list(Base.metadata.tables.keys())}")
    
    try:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Warning: Could not initialize database: {e}")
        
    yield test_engine
    await test_engine.dispose()

@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator:
    test_session_maker = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with test_session_maker() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session) -> AsyncGenerator:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    
    headers = {"X-API-Key": os.environ["AGENT_API_KEY"]}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=headers) as ac:
        yield ac
    
    app.dependency_overrides.clear()
