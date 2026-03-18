
import asyncio
from sqlalchemy import text
from database import engine

async def restore_welcome():
    print("⏳ Restoring ui_welcome_message for all agents...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("UPDATE agent_config SET ui_welcome_message = 'Olá! Como posso te ajudar hoje?' WHERE ui_welcome_message = '';"))
            print("✅ Welcome messages restored!")
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(restore_welcome())
