import asyncio
from sqlalchemy import text
from src.database import engine, Base
from src.models import (
    admin, agent, audit, cleanup_job, 
    container_health_metric, financial_record, 
    inbox, ingestion, process, process_log, 
    skill, stress_test, system_settings
)

async def init():
    print("🚀 Initializing database...")
    async with engine.begin() as conn:
        print("🛠️ Ensuring pgvector extension...")
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            print("✅ pgvector extension ensured.")
        except Exception as e:
            print(f"ℹ️ Extension note (already exists or handled): {e}")
            
        print("🛠️ Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database initialized successfully.")

if __name__ == "__main__":
    asyncio.run(init())
