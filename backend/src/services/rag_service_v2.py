import uuid
import logging
import hashlib
from typing import Optional, List
from datetime import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.knowledge_base import Skill, SkillVersion, VectorChunk, SkillVersionStatus
from src.services.rag_service import RAGService

logger = logging.getLogger(__name__)

class RAGServiceV2:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rag_base = RAGService(db)

    async def apply_correction_to_rag(self, agent_id: uuid.UUID, user_query: str, corrected_response: str):
        """
        FR-010: Versioned Knowledge Update.
        Creates a new draft version of the currently active skill, 
        appends the correction, and prepares it for activation.
        """
        # 1. Find the active skill for this agent
        # For simplicity in this module, we'll assume there's one primary skill per agent.
        # In a full system, we might look up which specific skill covers the topic.
        
        # Mocking skill lookup:
        skill_res = await self.db.execute(select(Skill).limit(1))
        skill = skill_res.scalar_one_or_none()
        
        if not skill:
            logger.warning(f"No skill found for agent {agent_id}. Cannot update RAG.")
            return
            
        # 2. Find active version
        active_version_id = skill.active_version_id
        
        # 3. Create a NEW VERSION (V+1)
        # In a real app, we'd copy over existing chunks or use a Delta approach.
        # Here we demonstrate the creation of the correction chunk in a new version.
        
        max_v_res = await self.db.execute(
            select(SkillVersion.version_number)
            .where(SkillVersion.skill_id == skill.id)
            .order_by(SkillVersion.version_number.desc())
            .limit(1)
        )
        last_v = max_v_res.scalar_one_or_none() or 0
        
        new_version = SkillVersion(
            id=uuid.uuid4(),
            skill_id=skill.id,
            version_number=last_v + 1,
            status=SkillVersionStatus.active, # Auto-activate for demo
            created_at=datetime.utcnow()
        )
        self.db.add(new_version)
        
        # 4. Generate Correction Chunk
        content = f"Q: {user_query}\nA: {corrected_response}"
        chunk_hash = hashlib.sha256(content.encode()).hexdigest()
        
        # Note: We need a source ID. Using a virtual "Correction Source"
        # In US3, items resolved in Inbox become virtual knowledge sources.
        
        embedding = await self.rag_base.get_embedding(content)
        
        chunk = VectorChunk(
            id=uuid.uuid4(),
            skill_version_id=new_version.id,
            skill_source_id=uuid.uuid4(), # Virtual source
            content=content,
            embedding=embedding,
            chunk_hash=chunk_hash
        )
        self.db.add(chunk)
        
        # 5. Switch active version (FR-011: Smooth Transition)
        skill.active_version_id = new_version.id
        
        await self.db.commit()
        logger.info(f"RAG corrected for Agent {agent_id}. Skill {skill.id} now on V{new_version.version_number}")
