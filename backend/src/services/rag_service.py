import os
import uuid
import openai
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.skill import VectorChunk

class RAGService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_embedding(self, text: str) -> Optional[List[float]]:
        """Generates embedding for the given text using OpenAI."""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None
                
            client = openai.AsyncOpenAI(api_key=api_key)
            
            text = text.replace("\n", " ")
            
            response = await client.embeddings.create(
                input=[text],
                model="text-embedding-3-small"
            )
            
            return response.data[0].embedding
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None

    async def persist_vector_chunk(self, skill_version_id: uuid.UUID, skill_source_id: uuid.UUID, content: str, product_id: Optional[str] = None) -> VectorChunk:
        import hashlib
        chunk_hash = hashlib.sha256(content.encode()).hexdigest()
        
        embedding = await self.get_embedding(content)
        
        chunk = VectorChunk(
            id=uuid.uuid4(),
            skill_version_id=skill_version_id,
            skill_source_id=skill_source_id,
            content=content,
            embedding=embedding,
            product_id=product_id,
            chunk_hash=chunk_hash
        )
        self.db.add(chunk)
        await self.db.commit()
        await self.db.refresh(chunk)
        return chunk
