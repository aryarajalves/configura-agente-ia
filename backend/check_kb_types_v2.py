import asyncio
import os
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine

# Manually load from .env since os.getenv is failing
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
    print(f"Connecting to {url}")
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, name, kb_type FROM knowledge_bases;"))
        rows = res.fetchall()
        print("\nKBs IN DATABASE:")
        for r in rows:
            print(f"ID={r[0]}, NAME={r[1]}, TYPE={r[2]}")

if __name__ == "__main__":
    asyncio.run(check())
