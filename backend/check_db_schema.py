
import asyncio
from sqlalchemy import text
from database import async_session

async def check_schema():
    async with async_session() as session:
        result = await session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'agent_config';"))
        columns = [row[0] for row in result.fetchall()]
        print(f"Columns in agent_config: {columns}")
        if 'inbox_capture_enabled' in columns:
            print("✅ Column 'inbox_capture_enabled' exists.")
        else:
            print("❌ Column 'inbox_capture_enabled' MISSING.")
            # Try to add it
            try:
                await session.execute(text("ALTER TABLE agent_config ADD COLUMN inbox_capture_enabled BOOLEAN DEFAULT TRUE;"))
                await session.commit()
                print("🚀 Column 'inbox_capture_enabled' added successfully.")
            except Exception as e:
                print(f"⚠️ Failed to add column: {e}")

if __name__ == "__main__":
    asyncio.run(check_schema())
