from datetime import datetime
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, JSON
import uuid
from backend.src.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    superadmin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=False)
    
    action = Column(String, nullable=False) # e.g., "UPDATE_CONFIG", "LOCK_AGENT"
    
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
