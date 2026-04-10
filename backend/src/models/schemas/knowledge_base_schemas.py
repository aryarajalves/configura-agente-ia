from pydantic import BaseModel, Field, UUID4, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from src.models.knowledge_base import KnowledgeBaseType, KnowledgeBaseStatus, KnowledgeBaseVersionStatus, SourceType

class KnowledgeBaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: KnowledgeBaseType = KnowledgeBaseType.hibrida

class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass

class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: UUID4
    status: KnowledgeBaseStatus
    active_version_id: Optional[UUID4] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class KnowledgeBaseSourceCreate(BaseModel):
    source_type: SourceType
    source_uri: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, alias='metadata_')

class KnowledgeBaseSourceResponse(BaseModel):
    id: UUID4
    knowledge_base_version_id: UUID4
    source_type: SourceType
    source_uri: str
    filename: str
    metadata_: Optional[Dict[str, Any]] = None
    checksum: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class KnowledgeBaseVersionResponse(BaseModel):
    id: UUID4
    knowledge_base_id: UUID4
    version_number: int
    status: KnowledgeBaseVersionStatus
    source_count: int
    processed_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class KnowledgeBaseStatusResponse(BaseModel):
    knowledge_base_id: UUID4
    status: KnowledgeBaseStatus
    active_version_id: Optional[UUID4] = None
    version_status: Optional[KnowledgeBaseVersionStatus] = None
    last_processed_at: Optional[datetime] = None

class KnowledgeBaseQueryRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)

class KnowledgeBaseQueryResponse(BaseModel):
    answer: str
    source_context: str
    price: Optional[float] = None
    stock: Optional[int] = None

class KnowledgeBaseVersionListResponse(BaseModel):
    versions: List[KnowledgeBaseVersionResponse]
