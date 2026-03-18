import asyncio
import os
import json
from sqlalchemy import select
from database import async_session
from models import KnowledgeItemModel
from rag_service import get_embedding

async def populate_missing_embeddings():
    async with async_session() as db:
        # Busca itens sem embedding
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.embedding.is_not(None) == False)
        result = await db.execute(stmt)
        items = result.scalars().all()
        
        print(f"Encontrados {len(items)} itens sem embedding.")
        
        for i, item in enumerate(items):
            # Concatena pergunta e resposta para gerar o embedding
            text_to_embed = f"{item.question} {item.answer}"
            print(f"[{i+1}/{len(items)}] Gerando embedding para: {item.question[:50]}...")
            
            embedding, usage = await get_embedding(text_to_embed)
            if embedding:
                item.embedding = embedding
                # Opcional: commit a cada X itens para segurança
                if (i + 1) % 10 == 0:
                    await db.commit()
            else:
                print(f"❌ Falha ao gerar embedding para o item {item.id}")
        
        await db.commit()
        print("✅ Processo concluído!")

if __name__ == "__main__":
    asyncio.run(populate_missing_embeddings())
