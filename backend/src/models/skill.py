import enum
from datetime import datetime
from sqlalchemy import Column, String, Enum, DateTime, UUID, ForeignKey, Integer, Text, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
import uuid
from src.database import Base
from pgvector.sqlalchemy import Vector

class SkillType(str, enum.Enum):
    documental = "documental"
    hibrida = "hibrida"

class SkillStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"

class SkillVersionStatus(str, enum.Enum):
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

class Skill(Base):
    __tablename__ = "skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    type = Column(Enum(SkillType), nullable=False)
    status = Column(Enum(SkillStatus), default=SkillStatus.draft, nullable=False)
    active_version_id = Column(UUID(as_uuid=True), ForeignKey("skill_versions.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SkillVersion(Base):
    __tablename__ = "skill_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    status = Column(Enum(SkillVersionStatus), default=SkillVersionStatus.processing, nullable=False)
    source_count = Column(Integer, default=0, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SkillSource(Base):
    __tablename__ = "skill_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_version_id = Column(UUID(as_uuid=True), ForeignKey("skill_versions.id"), nullable=False)
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
        UniqueConstraint('skill_version_id', 'product_id', 'chunk_hash', name='uq_vector_chunk_hash'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill_version_id = Column(UUID(as_uuid=True), ForeignKey("skill_versions.id"), nullable=False)
    skill_source_id = Column(UUID(as_uuid=True), ForeignKey("skill_sources.id"), nullable=False)
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
