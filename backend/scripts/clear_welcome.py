
import asyncio
from sqlalchemy import text
from database import engine

async def clear_welcome():
    print("⏳ Clearing ui_welcome_message for all agents...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("UPDATE agent_config SET ui_welcome_message = '';"))
            print("✅ All welcome messages cleared!")
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(clear_welcome())
