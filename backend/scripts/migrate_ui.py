
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
import sys

# Hardcoded for LOCAL migration via bridge/container
# Adjust port if running from outside docker (5433)
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@db:5432/ai_agent_db"

async def migrate():
    print("⏳ Starting UI Migration...")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        new_columns = [
            ("ui_primary_color", "VARCHAR DEFAULT '#6366f1'"),
            ("ui_header_color", "VARCHAR DEFAULT '#0f172a'"),
            ("ui_welcome_message", "TEXT DEFAULT 'Olá! Como posso te ajudar hoje?'")
        ]
        
        for col_name, col_type in new_columns:
            try:
                print(f"➕ Adding column: {col_name}...")
                await conn.execute(text(f"ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
            except Exception as e:
                print(f"⚠️ Error {col_name}: {e}")

    await engine.dispose()
    print("✅ UI Migration completed!")

if __name__ == "__main__":
    asyncio.run(migrate())
