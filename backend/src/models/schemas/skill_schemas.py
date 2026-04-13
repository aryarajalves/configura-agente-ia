from pydantic import BaseModel, Field, UUID4, ConfigDict
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from src.models.knowledge_base import SkillType, SkillStatus, SkillVersionStatus, SourceType

class SkillBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: SkillType = SkillType.hibrida

class SkillCreate(SkillBase):
    pass

class SkillResponse(SkillBase):
    id: UUID4
    status: SkillStatus
    active_version_id: Optional[UUID4] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SkillSourceCreate(BaseModel):
    source_type: SourceType
    source_uri: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, alias='metadata_')

class SkillSourceResponse(BaseModel):
    id: UUID4
    skill_version_id: UUID4
    source_type: SourceType
    source_uri: str
    filename: str
    metadata_: Optional[Dict[str, Any]] = None
    checksum: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SkillVersionResponse(BaseModel):
    id: UUID4
    skill_id: UUID4
    version_number: int
    status: SkillVersionStatus
    source_count: int
    processed_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SkillStatusResponse(BaseModel):
    skill_id: UUID4
    status: SkillStatus
    active_version_id: Optional[UUID4] = None
    version_status: Optional[SkillVersionStatus] = None
    last_processed_at: Optional[datetime] = None

class SkillQueryRequest(BaseModel):
    question: str
    product_id: str

class SkillQueryResponse(BaseModel):
    answer: str
    source_context: str
    price: Optional[float] = None
    stock: Optional[int] = None

class SkillVersionListResponse(BaseModel):
    versions: List[SkillVersionResponse]
