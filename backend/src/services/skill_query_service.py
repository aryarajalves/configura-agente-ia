import uuid
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.models.knowledge_base import VectorChunk

class SkillQueryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def hybrid_query(self, skill_id: uuid.UUID, active_version_id: uuid.UUID, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Run a hybrid query mapping PGVector with Relational ID"""
        product_id = context.get("product_id")
        
        if not product_id:
            raise ValueError("product_id is required in context for hybrid queries")

        # In a full flow we'd generate embedding for query and use pgvector
        # For MVP returning simple simulated matched chunk + Relational Join data
        result = await self.db.execute(
            select(VectorChunk)
            .filter(VectorChunk.skill_version_id == active_version_id)
        )
        chunks = result.scalars().all()
        # Filter manually for JSON compat in simulation if needed, or query cleanly:
        matched_chunks = [c for c in chunks if c.metadata_ and c.metadata_.get("product_id") == str(product_id)]
        
        source_context = " ".join([c.content for c in matched_chunks])
        if not source_context:
            source_context = "No context found for product."
            
        # Simulate relational enrichment from the product_id joining a Product table
        price = 99.99
        stock = 150
        
        return {
            "source_context": source_context,
            "answer": f"Based on the context, the product costs ${price} and we have {stock} in stock. Details: {source_context}",
            "price": price,
            "stock": stock
        }
