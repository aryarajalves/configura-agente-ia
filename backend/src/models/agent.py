import enum
from datetime import datetime
from sqlalchemy import Column, String, Enum, DateTime, UUID, Boolean, ForeignKey, JSON
import uuid
from backend.src.database import Base

class AgentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    superadmin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=False)
    
    status = Column(Enum(AgentStatus), default=AgentStatus.DRAFT, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    
    # Models
    model_fast_id = Column(String, nullable=False)
    model_analytic_id = Column(String, default="gpt-4", nullable=False)
    model_fallback_id = Column(String, nullable=True) # Optional at first
    
    # FR-012, FR-013: Security and Guardlines
    rules_config = Column(JSON, default={"blacklist": [], "double_check": False}, nullable=False)
    
    # Advanced Config (JSON)
    routing_thresholds = Column(JSON, default={}, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True) # Soft delete
