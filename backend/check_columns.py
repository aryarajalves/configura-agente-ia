import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

def get_env_url():
    with open(".env", "r") as f:
        for line in f:
            if "POSTGRES_USER" in line: user = line.split("=")[1].strip()
            if "POSTGRES_PASSWORD" in line: pw = line.split("=")[1].strip()
            if "POSTGRES_DB" in line: db = line.split("=")[1].strip()
            if "POSTGRES_PORT_EXTERNAL" in line: port = line.split("=")[1].strip()
    return f"postgresql+asyncpg://{user}:{pw}@localhost:{port}/{db}"

async def check():
    url = get_env_url()
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'knowledge_bases';"))
        rows = res.fetchall()
        print("\nCOLUMNS IN knowledge_bases:")
        for r in rows:
            print(f"COL={r[0]}, TYPE={r[1]}")

if __name__ == "__main__":
    asyncio.run(check())
