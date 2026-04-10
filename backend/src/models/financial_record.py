"""FinancialRecord model — per-agent, per-skill cost and token tracking."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Integer, Numeric, UUID, ForeignKey, Enum
from src.database import Base


class FinancialRecordType(str, enum.Enum):
    CHAT = "chat"
    FINE_TUNING = "fine_tuning"
    INGESTION = "ingestion"


class FinancialRecord(Base):
    __tablename__ = "financial_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=True, index=True)

    token_count = Column(Integer, nullable=False, default=0)
    estimated_cost = Column(Numeric(precision=12, scale=6), nullable=False, default=0)

    type = Column(Enum(FinancialRecordType), nullable=False, default=FinancialRecordType.CHAT)

    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
