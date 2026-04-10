"""
knowledge_bases.py  (formerly skills.py)
API router for /v1/knowledge-bases endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.schemas.knowledge_base_schemas import (
    KnowledgeBaseCreate, KnowledgeBaseResponse, KnowledgeBaseSourceCreate,
    KnowledgeBaseStatusResponse, KnowledgeBaseQueryRequest, KnowledgeBaseQueryResponse,
    KnowledgeBaseVersionListResponse
)
from src.api.auth import get_superadmin
from src.database import get_db
from src.services.knowledge_base_service import KnowledgeBaseService
from src.services.knowledge_base_version_service import KnowledgeBaseVersionService

router = APIRouter()

@router.get("", response_model=List[KnowledgeBaseResponse])
async def list_knowledge_bases(admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """List all available knowledge bases"""
    service = KnowledgeBaseService(db)
    kbs = await service.list_knowledge_bases()
    return [KnowledgeBaseResponse.model_validate(kb) for kb in kbs]

@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(kb_in: KnowledgeBaseCreate, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Create a new knowledge base"""
    service = KnowledgeBaseService(db)
    kb = await service.create_hybrid_knowledge_base(kb_in.name, kb_in.description)
    return KnowledgeBaseResponse.model_validate(kb)

@router.post("/{kb_id}/sources", status_code=status.HTTP_202_ACCEPTED)
async def add_source(kb_id: UUID, source_in: KnowledgeBaseSourceCreate, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Register a source and start ingestion"""
    service = KnowledgeBaseService(db)
    
    if source_in.metadata_ and source_in.metadata_.get("product_id"):
        target_table = source_in.metadata_.get("product_id")
        await service.validate_target_table(target_table)
        
    version_service = KnowledgeBaseVersionService(db)
    version = await service.start_ingestion(kb_id)
    
    from src.models.knowledge_base import KnowledgeBaseSource
    import uuid as _uuid
    new_source = KnowledgeBaseSource(
        id=_uuid.uuid4(),
        knowledge_base_version_id=version.id,
        source_type=source_in.source_type,
        source_uri=source_in.source_uri,
        filename=source_in.metadata_.get("filename", "unknown") if source_in.metadata_ else "unknown",
        metadata_=source_in.metadata_
    )
    db.add(new_source)
    await db.commit()
    
    return {"message": "Ingestion started", "version_id": version.id}

@router.get("/{kb_id}/status", response_model=KnowledgeBaseStatusResponse)
async def get_knowledge_base_status(kb_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Retrieve knowledge base and version status"""
    service = KnowledgeBaseService(db)
    kb = await service.get_knowledge_base(kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
        
    response = KnowledgeBaseStatusResponse(
        knowledge_base_id=kb.id,
        status=kb.status,
        active_version_id=kb.active_version_id
    )
    
    version_service = KnowledgeBaseVersionService(db)
    versions = await version_service.list_versions(kb_id)
    if versions:
        response.version_status = versions[0].status
        response.last_processed_at = versions[0].processed_at
        
    return response

@router.post("/{kb_id}/query", response_model=KnowledgeBaseQueryResponse)
async def query_knowledge_base(kb_id: UUID, query_in: KnowledgeBaseQueryRequest, db: AsyncSession = Depends(get_db)):
    """Run a hybrid query against a knowledge base"""
    service = KnowledgeBaseService(db)
    kb = await service.get_knowledge_base(kb_id)
    if not kb or not kb.active_version_id:
        raise HTTPException(status_code=404, detail="Knowledge base or active version not found")
        
    product_id = query_in.context.get("product_id") if hasattr(query_in, 'context') else None
        
    from src.services.skill_query_service import SkillQueryService
    query_service = SkillQueryService(db)
    try:
        response_data = await query_service.hybrid_query(kb_id, kb.active_version_id, query_in.query, {})
        return KnowledgeBaseQueryResponse(
            answer=response_data["answer"],
            source_context=response_data.get("source_context", "")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{kb_id}/versions", response_model=KnowledgeBaseVersionListResponse)
async def list_versions(kb_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """List all versions for a knowledge base"""
    version_service = KnowledgeBaseVersionService(db)
    versions = await version_service.list_versions(kb_id)
    return KnowledgeBaseVersionListResponse(versions=versions)

@router.post("/{kb_id}/versions/{version_id}/activate")
async def activate_version(kb_id: UUID, version_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Activate a pending version"""
    version_service = KnowledgeBaseVersionService(db)
    result = await version_service.activate_version(kb_id, version_id)
    if not result:
        raise HTTPException(status_code=404, detail="Version or knowledge base not found")
    return {"message": "Version activated", "active_version_id": version_id}

@router.post("/{kb_id}/versions/{version_id}/retry")
async def retry_version(kb_id: UUID, version_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Retry failed ingestion"""
    from src.services.skill_ingestion_service import start_ingestion_job
    from src.models.knowledge_base import KnowledgeBaseVersionStatus
    
    version_service = KnowledgeBaseVersionService(db)
    version = await version_service.get_version(version_id)
    if not version or version.knowledge_base_id != kb_id:
        raise HTTPException(status_code=404, detail="Version not found")
        
    if version.status not in [KnowledgeBaseVersionStatus.error, KnowledgeBaseVersionStatus.attention]:
        raise HTTPException(status_code=400, detail="Can only retry failed or attention versions")
        
    await version_service.set_version_status(version_id, KnowledgeBaseVersionStatus.processing, "")
    await start_ingestion_job(version_id)
    return {"message": "Retry queued"}
