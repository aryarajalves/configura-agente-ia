import asyncio
import os
from sqlalchemy import text
from src.database import engine

async def migrate():
    print("Migrating admins table...")
    async with engine.connect() as conn:
        try:
            await conn.execute(text("ALTER TABLE admins ADD COLUMN IF NOT EXISTS name VARCHAR;"))
            await conn.commit()
            print("Successfully added 'name' column to 'admins' table.")
        except Exception as e:
            print(f"Migration failed or column already exists: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
