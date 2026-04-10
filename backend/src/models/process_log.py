import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from src.models.process import Base, ProcessStep

class LogLevel(str, Enum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"

class LogEntry(Base):
    __tablename__ = "process_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    step_id = Column(UUID(as_uuid=True), ForeignKey("process_steps.id"), nullable=False)
    level = Column(SAEnum(LogLevel), default=LogLevel.INFO)
    message = Column(String, nullable=False)
    metadata_json = Column(JSONB, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)

    step = relationship("ProcessStep")
