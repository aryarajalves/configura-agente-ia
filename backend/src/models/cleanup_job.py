"""CleanupJob model — background cleanup task state and retry tracking."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Integer, UUID, Enum, Text
from backend.src.database import Base


class CleanupJobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class CleanupJob(Base):
    __tablename__ = "cleanup_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_name = Column(String, nullable=False)  # e.g. "cleanup_audit_logs"
    status = Column(Enum(CleanupJobStatus), nullable=False, default=CleanupJobStatus.PENDING)
    last_run_at = Column(DateTime, nullable=True)
    failure_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
