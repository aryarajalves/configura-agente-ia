import asyncio
import os
from database import async_session
from models import BackgroundProcessLog
from sqlalchemy import select

async def check():
    async with async_session() as db:
        r = await db.execute(select(BackgroundProcessLog).order_by(BackgroundProcessLog.created_at.desc()).limit(15))
        logs = r.scalars().all()
        for l in logs:
            print(f"ID: {l.id} | Name: {l.process_name} | Status: {l.status} | Progress: {l.progress} | Error: {l.error_message}")

if __name__ == "__main__":
    asyncio.run(check())
