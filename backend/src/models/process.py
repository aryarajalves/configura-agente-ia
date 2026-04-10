import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

class ProcessType(str, Enum):
    UPLOAD = "UPLOAD"
    AI_PROCESSING = "AI_PROCESSING"
    DB_MAINTENANCE = "DB_MAINTENANCE"

class ProcessStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

from sqlalchemy.orm import declarative_base
Base = declarative_base()

class Process(Base):
    __tablename__ = "processes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    type = Column(SAEnum(ProcessType), nullable=False)
    status = Column(SAEnum(ProcessStatus), default=ProcessStatus.PENDING)
    total_progress = Column(Float, default=0.0)
    current_step_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    steps = relationship("ProcessStep", back_populates="process", cascade="all, delete-orphan")

class ProcessStep(Base):
    __tablename__ = "process_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    process_id = Column(UUID(as_uuid=True), ForeignKey("processes.id"), nullable=False)
    name = Column(String, nullable=False)
    weight_percentage = Column(Float, nullable=False)
    order = Column(Integer, nullable=False)
    status = Column(SAEnum(ProcessStatus), default=ProcessStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    process = relationship("Process", back_populates="steps")
