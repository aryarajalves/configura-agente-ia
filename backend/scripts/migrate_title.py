
import asyncio
from sqlalchemy import text
from database import engine

async def migrate():
    print("⏳ Adding ui_chat_title column to agent_config table...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS ui_chat_title VARCHAR DEFAULT 'Suporte Inteligente';"))
            print("✅ Column ui_chat_title added successfully!")
        except Exception as e:
            print(f"❌ Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
