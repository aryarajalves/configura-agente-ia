import asyncio
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from sqlalchemy import select
from database import async_session
from models import GlobalContextVariableModel

async def check():
    try:
        async with async_session() as session:
            res = await session.execute(select(GlobalContextVariableModel))
            vars = res.scalars().all()
            print("--- DATABASE VARIABLES ---")
            for v in vars:
                print(f"KEY: {v.key}")
                print(f"VALUE: {v.value}")
                print(f"DESC: {v.description}")
                print("-" * 20)
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(check())
