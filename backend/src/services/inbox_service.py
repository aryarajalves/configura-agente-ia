import uuid
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.inbox import InboxItem, InboxItemStatus
from src.models.knowledge_base import VectorChunk # Assuming this exists or will exist

logger = logging.getLogger(__name__)

class InboxService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_inbox_item(
        self, 
        agent_id: uuid.UUID, 
        user_query: str, 
        ai_response: str, 
        failure_reason: str, 
        context: Dict[str, Any]
    ) -> InboxItem:
        import json
        item = InboxItem(
            agent_id=str(agent_id),
            pergunta_usuario=user_query,
            resposta_ia=ai_response,
            motivo_falha=failure_reason,
            status=InboxItemStatus.PENDENTE,
            context_data=json.dumps(context)
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        
        # Trigger grouping
        await self.group_similar_failures()
        
        return item

    async def list_items(
        self, 
        status: Optional[InboxItemStatus] = None, 
        group_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[InboxItem]:
        query = select(InboxItem)
        if status:
            query = query.where(InboxItem.status == status)
        if group_id:
            query = query.where(InboxItem.group_id == group_id)
        
        query = query.order_by(InboxItem.frequencia_erro.desc(), InboxItem.created_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_item(self, item_id: uuid.UUID) -> Optional[InboxItem]:
        result = await self.db.execute(select(InboxItem).where(InboxItem.id == str(item_id)))
        return result.scalar_one_or_none()

    async def update_suggestion(self, item_id: uuid.UUID, edited_suggestion: str) -> Optional[InboxItem]:
        await self.db.execute(
            update(InboxItem)
            .where(InboxItem.id == str(item_id))
            .values(sugestao_ia=edited_suggestion, updated_at=datetime.utcnow())
        )
        await self.db.commit()
        return await self.get_item(item_id)

    async def resolve_item(self, item_id: uuid.UUID, final_response: str, resolver_id: uuid.UUID, apply_to_rag: bool = False) -> Optional[InboxItem]:
        values = {
            "resposta_final_usuario": final_response,
            "status": InboxItemStatus.RESOLVIDO,
            "resolver_id": str(resolver_id),
            "updated_at": datetime.utcnow()
        }
        
        await self.db.execute(
            update(InboxItem)
            .where(InboxItem.id == str(item_id))
            .values(**values)
        )
        
        if apply_to_rag:
            from src.services.rag_service_v2 import RAGServiceV2
            rag_service = RAGServiceV2(self.db)
            item = await self.get_item(item_id)
            if item:
                await rag_service.apply_correction_to_rag(
                    agent_id=uuid.UUID(item.agent_id),
                    user_query=item.pergunta_usuario,
                    corrected_response=final_response
                )

        await self.db.commit()
        return await self.get_item(item_id)

    async def discard_item(self, item_id: uuid.UUID, resolver_id: uuid.UUID) -> Optional[InboxItem]:
        await self.db.execute(
            update(InboxItem)
            .where(InboxItem.id == str(item_id))
            .values(status=InboxItemStatus.DESCARTADO, discarded=True, resolver_id=str(resolver_id), updated_at=datetime.utcnow())
        )
        await self.db.commit()
        return await self.get_item(item_id)

    async def block_topic(self, item_id: uuid.UUID, resolver_id: uuid.UUID) -> Optional[InboxItem]:
        await self.db.execute(
            update(InboxItem)
            .where(InboxItem.id == str(item_id))
            .values(status=InboxItemStatus.BLOQUEADO, blocked=True, resolver_id=str(resolver_id), updated_at=datetime.utcnow())
        )
        await self.db.commit()
        return await self.get_item(item_id)

    async def group_similar_failures(self, threshold: float = 60.0):
        # Implementation using RapidFuzz for string similarity (T013)
        from rapidfuzz import process, fuzz
        
        # 1. Fetch pending items without group_id
        result = await self.db.execute(
            select(InboxItem).where(InboxItem.status == InboxItemStatus.PENDENTE, InboxItem.group_id == None)
        )
        ungrouped_items = result.scalars().all()
        
        if not ungrouped_items:
            return

        # 2. Fetch all PENDING items to compare against
        all_pending_res = await self.db.execute(
            select(InboxItem).where(InboxItem.status == InboxItemStatus.PENDENTE)
        )
        all_pending = all_pending_res.scalars().all()
        
        for item in ungrouped_items:
            # Find best match in others (exclude items without ID yet or self)
            others = [i for i in all_pending if i.id != item.id]
            if not others:
                # No one to compare with, must be lead
                item.group_id = item.id
                continue
                
            queries = [i.pergunta_usuario for i in others]
            best_match = process.extractOne(item.pergunta_usuario, queries, scorer=fuzz.token_sort_ratio)
            
            if best_match and best_match[1] >= threshold:
                matched_item = others[best_match[2]]
                # Attach to matched item's group
                target_group_id = matched_item.group_id or matched_item.id
                item.group_id = target_group_id
                
                # Increment frequency on the group lead
                await self.db.execute(
                    update(InboxItem)
                    .where(InboxItem.id == target_group_id)
                    .values(frequencia_erro=InboxItem.frequencia_erro + 1)
                )
            else:
                # New cluster lead
                item.group_id = item.id
        
        await self.db.commit()
