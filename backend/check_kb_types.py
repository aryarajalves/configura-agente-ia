import asyncio
from sqlalchemy import select, text
from database import engine
from models import KnowledgeBaseModel

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, name, kb_type FROM knowledge_bases;"))
        rows = res.fetchall()
        print("KBs IN DATABASE:")
        for r in rows:
            print(f"ID={r[0]}, NAME={r[1]}, TYPE={r[2]}")

if __name__ == "__main__":
    asyncio.run(check())
