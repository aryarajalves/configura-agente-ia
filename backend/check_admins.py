import asyncio
import os
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from dotenv import load_dotenv
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from src.models.admin import Admin, AdminRole
from src.database import Base, DATABASE_URL

async def check_admins():
    print(f"Connecting to: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession)
    
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Admin))
            admins = result.scalars().all()
            print(f"Found {len(admins)} admins.")
            for admin in admins:
                print(f" - ID: {admin.id}, Email: {admin.email}, Role: {admin.role}")
        except Exception as e:
            print(f"Error checking admins: {e}")
    await engine.dispose()

if __name__ == "__main__":
    load_dotenv()
    asyncio.run(check_admins())
