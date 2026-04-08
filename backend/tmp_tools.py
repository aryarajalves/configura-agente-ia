import asyncio
import sys
from database import async_session
from models import ToolModel
from sqlalchemy import select

async def get_tools():
    async with async_session() as db:
        res = await db.execute(select(ToolModel))
        tools = res.scalars().all()
        for t in tools:
            sys.stdout.write(f'TOOL_FOUND: {t.id} - {t.name}\n')

if __name__ == "__main__":
    asyncio.run(get_tools())
