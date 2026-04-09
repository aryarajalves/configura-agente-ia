"""ContainerHealthMetric model — disk and memory health history."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Numeric, UUID
from backend.src.database import Base


class ContainerHealthMetric(Base):
    __tablename__ = "container_health_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    disk_usage_percent = Column(Numeric(precision=5, scale=2), nullable=False)
    memory_usage_percent = Column(Numeric(precision=5, scale=2), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    container_id = Column(String, nullable=True)
