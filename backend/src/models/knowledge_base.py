import enum
from datetime import datetime
from sqlalchemy import Column, String, Enum, DateTime, UUID, ForeignKey, Integer, Text, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
import uuid
from src.database import Base
from pgvector.sqlalchemy import Vector

class KnowledgeBaseType(str, enum.Enum):
    documental = "documental"
    hibrida = "hibrida"

class KnowledgeBaseStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"

class KnowledgeBaseVersionStatus(str, enum.Enum):
    processing = "processing"
    active = "active"
    attention = "attention"
    error = "error"

class SourceType(str, enum.Enum):
    pdf = "pdf"
    txt = "txt"
    excel = "excel"
    csv = "csv"
    audio = "audio"
    video = "video"

class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    type = Column(Enum(KnowledgeBaseType), nullable=False)
    status = Column(Enum(KnowledgeBaseStatus), default=KnowledgeBaseStatus.draft, nullable=False)
    active_version_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_base_versions.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class KnowledgeBaseVersion(Base):
    __tablename__ = "knowledge_base_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_base_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    status = Column(Enum(KnowledgeBaseVersionStatus), default=KnowledgeBaseVersionStatus.processing, nullable=False)
    source_count = Column(Integer, default=0, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class KnowledgeBaseSource(Base):
    __tablename__ = "knowledge_base_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_base_version_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_base_versions.id"), nullable=False)
    source_type = Column(Enum(SourceType), nullable=False)
    source_uri = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)
    checksum = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class VectorChunk(Base):
    __tablename__ = "vector_chunks"
    __table_args__ = (
        UniqueConstraint('knowledge_base_version_id', 'product_id', 'chunk_hash', name='uq_vector_chunk_hash'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_base_version_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_base_versions.id"), nullable=False)
    knowledge_base_source_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_base_sources.id"), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=True)
    product_id = Column(String, nullable=True)
    chunk_hash = Column(String, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ProductTable(Base):
    """
    Mock/Placeholder ProductTable to test hybrid joins if needed.
    """
    __tablename__ = "products"

    product_id = Column(String, primary_key=True)
    price = Column(Numeric(10, 2), nullable=True)
    stock = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Backward-compatibility aliases (used by legacy code importing from skill.py) ───
# These allow old imports to keep working while we migrate gradually
SkillType = KnowledgeBaseType
SkillStatus = KnowledgeBaseStatus
SkillVersionStatus = KnowledgeBaseVersionStatus
Skill = KnowledgeBase
SkillVersion = KnowledgeBaseVersion
SkillSource = KnowledgeBaseSource
