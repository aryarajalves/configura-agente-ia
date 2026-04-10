"""AuditLog model — extended for generic entity tracking and deleted-user preservation."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, JSON
import uuid
from src.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    superadmin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=False)

    action = Column(String, nullable=False)  # e.g., "UPDATE_CONFIG", "LOCK_AGENT"

    # T006: Generic entity tracking
    target_entity_type = Column(String, nullable=True)  # "agent", "skill", "user", "system_settings"
    target_entity_id = Column(UUID(as_uuid=True), nullable=True)  # FK-free generic ref

    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)

    timestamp = Column(DateTime, default=datetime.utcnow)

    # T006: Preserve identity of deleted users
    deleted_user_display = Column(String, nullable=True)  # e.g. "João Silva (Removido)"
