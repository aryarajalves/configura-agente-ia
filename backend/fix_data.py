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

async def fix():
    url = get_env_url()
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("UPDATE knowledge_bases SET kb_type='product' WHERE name IN ('Produtos do Eneagrama', 'Teste');"))
        await conn.commit()
        print(f"Fixed {res.rowcount} rows.")

if __name__ == "__main__":
    asyncio.run(fix())
