import asyncio
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from sqlalchemy import select
from database import async_session
from models import GlobalContextVariableModel

async def repair():
    async with async_session() as session:
        # Forçar a criação das variáveis padrão se não existirem
        res = await session.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == 'contact_name'))
        v = res.scalars().first()
        
        if not v:
            print("Creating contact_name...")
            v = GlobalContextVariableModel(
                key='contact_name',
                value='Usuário Teste',
                description='Nome do contato para personalização.',
                is_default=True
            )
            session.add(v)
        else:
            print("Updating contact_name...")
            v.value = 'Usuário Teste'
            v.description = 'Nome do contato para personalização.'
            
        res2 = await session.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == 'contact_phone'))
        v2 = res2.scalars().first()
        if not v2:
            print("Creating contact_phone...")
            v2 = GlobalContextVariableModel(
                key='contact_phone',
                value='5511999999999',
                description='Telefone do contato.',
                is_default=True
            )
            session.add(v2)
        else:
            print("Updating contact_phone...")
            v2.value = '5511999999999'
            v2.description = 'Telefone do contato.'

        await session.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(repair())
