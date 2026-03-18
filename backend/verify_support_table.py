import asyncio
from sqlalchemy import text
from database import engine

async def check_table():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name='support_requests'"))
        row = res.fetchone()
        if row:
            print(f"TABELA ENCONTRADA: {row[0]}")
        else:
            print("TABELA NÃO ENCONTRADA")

if __name__ == "__main__":
    asyncio.run(check_table())
