from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.src.database import get_db
from backend.src.services.inbox_service import InboxService
from backend.src.api.auth import get_current_user
from backend.src.models.schemas import SuccessResponse
from backend.src.models.inbox import InboxItemStatus
from backend.src.models.admin import AdminRole
from uuid import UUID
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

async def get_curator_or_above(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in [AdminRole.SUPERADMIN, AdminRole.ADMIN, AdminRole.CURATOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: CURATOR role or above required"
        )
    return current_user

class SuggestionUpdate(BaseModel):
    edited_suggestion: str

class ResolveRequest(BaseModel):
    final_response: str
    apply_to_rag: bool = False

@router.get("/", response_model=SuccessResponse)
async def list_inbox_items(
    status: Optional[InboxItemStatus] = None,
    group_id: Optional[UUID] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_curator_or_above)
):
    service = InboxService(db)
    items = await service.list_items(status=status, group_id=group_id, limit=limit, offset=offset)
    return SuccessResponse(data=[{
        "id": str(i.id),
        "status": i.status,
        "frequencia_erro": i.frequencia_erro,
        "pergunta_usuario": i.pergunta_usuario,
        "resposta_ia": i.resposta_ia,
        "motivo_falha": i.motivo_falha,
        "sugestao_ia": i.sugestao_ia
    } for i in items])
    
@router.get("/{item_id}", response_model=SuccessResponse)
async def get_inbox_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_curator_or_above)
):
    service = InboxService(db)
    item = await service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return SuccessResponse(data={
        "id": str(item.id),
        "status": item.status,
        "frequencia_erro": item.frequencia_erro,
        "pergunta_usuario": item.pergunta_usuario,
        "resposta_ia": item.resposta_ia,
        "motivo_falha": item.motivo_falha,
        "sugestao_ia": item.sugestao_ia
    })

@router.put("/{item_id}/suggestion", response_model=SuccessResponse)
async def update_item_suggestion(
    item_id: UUID,
    payload: SuggestionUpdate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_curator_or_above)
):
    service = InboxService(db)
    item = await service.update_suggestion(item_id, payload.edited_suggestion)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return SuccessResponse(message="Suggestion updated")

@router.post("/{item_id}/resolve", response_model=SuccessResponse)
async def resolve_inbox_item(
    item_id: UUID,
    payload: ResolveRequest,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_curator_or_above)
):
    service = InboxService(db)
    item = await service.resolve_item(
        item_id, 
        payload.final_response, 
        resolver_id=UUID(admin["id"]),
        apply_to_rag=payload.apply_to_rag
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return SuccessResponse(message="Item resolved")

@router.post("/{item_id}/discard", response_model=SuccessResponse)
async def discard_inbox_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_curator_or_above)
):
    service = InboxService(db)
    item = await service.discard_item(item_id, resolver_id=UUID(admin["id"]))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return SuccessResponse(message="Item discarded")

@router.post("/{item_id}/block", response_model=SuccessResponse)
async def block_inbox_item_topic(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(get_curator_or_above)
):
    service = InboxService(db)
    item = await service.block_topic(item_id, resolver_id=UUID(admin["id"]))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return SuccessResponse(message="Topic blocked")
