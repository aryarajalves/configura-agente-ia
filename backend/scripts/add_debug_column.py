
import asyncio
import os
import sys

# Adiciona o diretório pai ao path para importar modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text

async def add_debug_column():
    print("🔌 Conectando ao banco de dados...")
    async with engine.begin() as conn:
        print("🔍 Verificando se a coluna 'debug_info' existe na tabela 'interaction_logs'...")
        
        # Check if column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='interaction_logs' AND column_name='debug_info';
        """))
        
        if result.rowcount > 0:
            print("✅ A coluna 'debug_info' já existe. Nenhuma ação necessária.")
        else:
            print("⚠️ Coluna não encontrada. Adicionando coluna 'debug_info'...")
            await conn.execute(text("ALTER TABLE interaction_logs ADD COLUMN debug_info TEXT;"))
            print("✅ Coluna 'debug_info' adicionada com sucesso!")

if __name__ == "__main__":
    # Windows loop policy fix
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    asyncio.run(add_debug_column())
