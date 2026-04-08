import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, JSON, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.src.database import Base

class StressTestStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"

class StressTestPersona(Base):
    __tablename__ = "stress_test_personas"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    behavior_config = Column(JSON, nullable=False) # Persona prompts, tone, etc.
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions = relationship("StressTestSession", back_populates="persona")

class StressTestSession(Base):
    __tablename__ = "stress_test_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    persona_id = Column(String, ForeignKey("stress_test_personas.id"), nullable=False)
    
    # Snapshot behavior for reproducibility
    persona_snapshot = Column(JSON, nullable=False)
    
    status = Column(Enum(StressTestStatus), default=StressTestStatus.QUEUED)
    progress_percentage = Column(Integer, default=0)
    taskiq_task_id = Column(String, nullable=True)
    
    relatorio_md_link = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_by = Column(String, nullable=False) # User UUID reference
    
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    persona = relationship("StressTestPersona", back_populates="sessions")
