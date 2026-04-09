from sqlalchemy import Column, String, Integer, Text, DateTime, Enum, JSON
from datetime import datetime
import enum
import uuid
import sys
import os

# Adds backend directory to path if needed for database import
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database import Base

class IngestionStatus(str, enum.Enum):
    INITIATED = "initiated"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class IngestionTask(Base):
    __tablename__ = "ingestion_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    file_hash = Column(String(64), nullable=False)
    status = Column(Enum(IngestionStatus), default=IngestionStatus.INITIATED, nullable=False)
    remote_id = Column(String, nullable=True) # ID of the file in B2
    error_message = Column(Text, nullable=True)
    progress = Column(Integer, default=0)
    current_step = Column(String, nullable=True)
    logs = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
