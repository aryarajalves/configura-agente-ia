"""SystemSettings model — governance retention policies and alert configuration."""

import uuid
from datetime import datetime

from sqlalchemy import Column, Integer, DateTime, UUID, ForeignKey
from backend.src.database import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    retention_period_days = Column(Integer, nullable=False, default=90)
    storage_threshold_alert = Column(Integer, nullable=False, default=80)  # percent
    last_cleanup_timestamp = Column(DateTime, nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
