
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Hardcoded for simplicity or read from .env if needed
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5433/ai_agent_db"

async def migrate():
    print("⏳ Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("🔍 Checking schema...")
        
        # New columns to add
        new_columns = [
            ("security_competitor_blacklist", "TEXT"),
            ("security_forbidden_topics", "TEXT"),
            ("security_discount_policy", "TEXT"),
            ("security_language_complexity", "VARCHAR DEFAULT 'standard'"),
            ("security_pii_filter", "BOOLEAN DEFAULT FALSE")
        ]
        
        for col_name, col_type in new_columns:
            try:
                print(f"➕ Adding column: {col_name}...")
                await conn.execute(text(f"ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
            except Exception as e:
                print(f"⚠️ Error adding {col_name}: {e}")

        # Old columns to remove (Optional cleanup)
        old_columns = [
            "web_browsing_enabled",
            "web_browsing_scope",
            "web_browsing_rules"
        ]
        
        for col_name in old_columns:
            try:
                print(f"➖ Removing column: {col_name}...")
                await conn.execute(text(f"ALTER TABLE agent_config DROP COLUMN IF EXISTS {col_name};"))
            except Exception as e:
                print(f"⚠️ Error removing {col_name}: {e}")

    await engine.dispose()
    print("✅ Migration completed!")

if __name__ == "__main__":
    asyncio.run(migrate())
