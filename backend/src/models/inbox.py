import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Enum, DateTime, ForeignKey, Text, Boolean
from backend.src.database import Base

class InboxItemStatus(str, enum.Enum):
    PENDENTE = "pendente"
    RESOLVIDO = "resolvido"
    DESCARTADO = "descartado"
    BLOQUEADO = "bloqueado"

class BackgroundTaskType(str, enum.Enum):
    INGESTAO = "ingestao"
    STRESSTEST = "stresstest"

class BackgroundTaskStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"

class InboxItem(Base):
    __tablename__ = "inbox_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String, nullable=False, index=True)
    pergunta_usuario = Column(Text, nullable=False)
    resposta_ia = Column(Text, nullable=True)
    motivo_falha = Column(Text, nullable=True)
    sugestao_ia = Column(Text, nullable=True)
    resposta_final_usuario = Column(Text, nullable=True)
    
    frequencia_erro = Column(Integer, default=1)
    status = Column(Enum(InboxItemStatus), default=InboxItemStatus.PENDENTE)
    
    group_id = Column(String, nullable=True, index=True) # UUID for string similarity clustering
    
    blocked = Column(Boolean, default=False)
    discarded = Column(Boolean, default=False)
    
    resolver_id = Column(String, nullable=True) # User UUID reference
    knowledge_version_id = Column(String, nullable=True) # RAG version snapshot reference
    context_data = Column(Text, nullable=True) # JSON stored as text for simplicity in first iteration

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BackgroundTask(Base):
    __tablename__ = "background_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tipo = Column(Enum(BackgroundTaskType), nullable=False)
    taskiq_task_id = Column(String, nullable=True, index=True)
    
    related_session_id = Column(String, nullable=True) # Reference to StressTestSession
    related_inbox_item_id = Column(String, nullable=True) # Reference to InboxItem
    
    status = Column(Enum(BackgroundTaskStatus), default=BackgroundTaskStatus.QUEUED)
    progresso = Column(Integer, default=0)
    log_tecnico = Column(Text, nullable=True)
    
    timestamp_inicio = Column(DateTime, nullable=True)
    timestamp_fim = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
