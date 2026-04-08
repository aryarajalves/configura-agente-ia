from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models.schemas.skill_schemas import (
    SkillCreate, SkillResponse, SkillSourceCreate, SkillSourceResponse,
    SkillStatusResponse, SkillQueryRequest, SkillQueryResponse, SkillVersionListResponse
)
from backend.src.api.auth import get_superadmin
from backend.src.database import get_db
from backend.src.services.skill_service import SkillService
from backend.src.services.skill_version_service import SkillVersionService

router = APIRouter(prefix="/skills", tags=["Skills"])

@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(skill_in: SkillCreate, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Create a new hybrid skill"""
    skill_service = SkillService(db)
    skill = await skill_service.create_hybrid_skill(skill_in.name, skill_in.description)
    return SkillResponse.model_validate(skill)

@router.post("/{skill_id}/sources", status_code=status.HTTP_202_ACCEPTED)
async def add_source(skill_id: UUID, source_in: SkillSourceCreate, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Register source and start ingestion"""
    skill_service = SkillService(db)
    
    # Optional US1 validation of postgres table mapped
    if source_in.metadata_ and source_in.metadata_.get("product_id"):
        # For simplicity, treat the "product_id" field in metadata as the table name for US1 testing mapping
        target_table = source_in.metadata_.get("product_id")
        # In a real scenario we'd query the DB schema, this is a placeholder check
        is_valid = await skill_service.validate_target_table(target_table)
        # We won't block here strictly for prototype if validate_target_table returns false since we might not have the table yet
        
    version_service = SkillVersionService(db)
    version = await skill_service.start_ingestion(skill_id)
    
    from backend.src.models.skill import SkillSource
    import uuid
    # Create the source record linked to the pending version
    new_source = SkillSource(
        id=uuid.uuid4(),
        skill_version_id=version.id,
        source_type=source_in.source_type,
        source_uri=source_in.source_uri,
        filename=source_in.metadata_.get("filename", "unknown") if source_in.metadata_ else "unknown",
        metadata_=source_in.metadata_
    )
    db.add(new_source)
    await db.commit()
    
    return {"message": "Ingestion started", "version_id": version.id}

@router.get("/{skill_id}/status", response_model=SkillStatusResponse)
async def get_skill_status(skill_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Retrieve skill and version status"""
    skill_service = SkillService(db)
    skill = await skill_service.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
        
    response = SkillStatusResponse(
        skill_id=skill.id,
        status=skill.status,
        active_version_id=skill.active_version_id
    )
    
    # Get latest version status if any
    version_service = SkillVersionService(db)
    versions = await version_service.list_versions(skill_id)
    if versions:
        response.version_status = versions[0].status
        response.last_processed_at = versions[0].processed_at
        
    return response

@router.post("/{skill_id}/query", response_model=SkillQueryResponse)
async def query_hybrid_skill(skill_id: UUID, query_in: SkillQueryRequest, db: AsyncSession = Depends(get_db)):
    """Run a hybrid query"""
    skill_service = SkillService(db)
    skill = await skill_service.get_skill(skill_id)
    if not skill or not skill.active_version_id:
        raise HTTPException(status_code=404, detail="Skill or active version not found")
        
    product_id = query_in.context.get("product_id")
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is missing from query context")
        
    from backend.src.services.skill_query_service import SkillQueryService
    query_service = SkillQueryService(db)
    try:
        response_data = await query_service.hybrid_query(skill_id, skill.active_version_id, query_in.query, query_in.context)
        return SkillQueryResponse(
            answer=response_data["answer"],
            sources=[{"product_id": product_id, "context": response_data["source_context"]}],
            metadata_=response_data
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{skill_id}/versions", response_model=SkillVersionListResponse)
async def list_versions(skill_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """List all versions"""
    version_service = SkillVersionService(db)
    versions = await version_service.list_versions(skill_id)
    return SkillVersionListResponse(versions=versions)

@router.post("/{skill_id}/versions/{version_id}/activate")
async def activate_version(skill_id: UUID, version_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Activate a pending version"""
    version_service = SkillVersionService(db)
    result = await version_service.activate_version(skill_id, version_id)
    if not result:
        raise HTTPException(status_code=404, detail="Version or Skill not found")
    return {"message": "Version activated", "active_version_id": version_id}

@router.post("/{skill_id}/versions/{version_id}/retry")
async def retry_version(skill_id: UUID, version_id: UUID, admin: dict = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    """Retry failed ingestion"""
    from backend.src.services.skill_ingestion_service import start_ingestion_job
    from backend.src.models.skill import SkillVersionStatus
    
    version_service = SkillVersionService(db)
    version = await version_service.get_version(version_id)
    if not version or version.skill_id != skill_id:
        raise HTTPException(status_code=404, detail="Version not found")
        
    if version.status not in [SkillVersionStatus.error, SkillVersionStatus.attention]:
        raise HTTPException(status_code=400, detail="Can only retry failed or attention versions")
        
    await version_service.set_version_status(version_id, SkillVersionStatus.processing, "")
    await start_ingestion_job(version_id)
    return {"message": "Retry queued"}
