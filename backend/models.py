from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# Tabela de associação para Muitos-para-Muitos entre Agentes e Ferramentas
agent_tools = Table(
    "agent_tools",
    Base.metadata,
    Column("agent_id", Integer, ForeignKey("agent_config.id", ondelete="CASCADE"), primary_key=True),
    Column("tool_id", Integer, ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True),
)

# Tabela de associação para Muitos-para-Muitos entre Agentes e Bases de Conhecimento
agent_knowledge_bases = Table(
    "agent_knowledge_bases",
    Base.metadata,
    Column("agent_id", Integer, ForeignKey("agent_config.id", ondelete="CASCADE"), primary_key=True),
    Column("knowledge_base_id", Integer, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), primary_key=True),
)

class InteractionLog(Base):
    __tablename__ = "interaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_config.id", ondelete="SET NULL"), nullable=True) # Link to agent
    session_id = Column(String, index=True, nullable=True) # New: Identify memory scope
    user_message = Column(Text)
    agent_response = Column(Text)
    model_used = Column(String)
    input_tokens = Column(Integer)
    output_tokens = Column(Integer)
    cost_usd = Column(Float)
    cost_brl = Column(Float)
    handoff_to = Column(String, nullable=True) # Ex: "suporte", "vendas", "humano"
    debug_info = Column(Text, nullable=True) # JSON stored as string
    timestamp = Column(DateTime, default=datetime.utcnow)

class SessionSummary(Base):
    __tablename__ = "session_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, unique=True)
    agent_id = Column(Integer, ForeignKey("agent_config.id", ondelete="CASCADE"))
    summary_text = Column(Text)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    cost_brl = Column(Float, default=0.0)
    is_test_session = Column(Boolean, default=False)
    test_report = Column(JSON, nullable=True) # Armazena o JSON do relatório do tester
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class KnowledgeBaseModel(Base):
    __tablename__ = "knowledge_bases"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, default="Nova Base")
    description = Column(Text, nullable=True)
    kb_type = Column(String, default="qa")
    question_label = Column(String, default="Pergunta")
    answer_label = Column(String, default="Resposta")
    metadata_label = Column(String, default="Metadado")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = relationship("KnowledgeItemModel", back_populates="knowledge_base", cascade="all, delete-orphan")
    
    # Legacy link (1-to-N)
    agents = relationship("AgentConfigModel", back_populates="linked_knowledge_base")
    
    # New M2M link
    linked_agents = relationship("AgentConfigModel", secondary=agent_knowledge_bases, back_populates="knowledge_bases")

from pgvector.sqlalchemy import Vector

class KnowledgeItemModel(Base):
    __tablename__ = "knowledge_items"
    
    id = Column(Integer, primary_key=True, index=True)
    knowledge_base_id = Column(Integer, ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    question = Column(Text)
    answer = Column(Text)
    metadata_val = Column(Text)
    category = Column(String, nullable=True, default="Geral")
    source_metadata = Column(Text, nullable=True) # JSON store for page_number, source_file, etc.
    embedding = Column(Vector(1536), nullable=True) # OpenAI small is 1536 dims
    parent_id = Column(Integer, ForeignKey("knowledge_items.id", ondelete="SET NULL"), nullable=True)
    
    knowledge_base = relationship("KnowledgeBaseModel", back_populates="items")
    children = relationship("KnowledgeItemModel", backref="parent", remote_side=[id])

class AgentConfigModel(Base):
    __tablename__ = "agent_config"

    id = Column(Integer, primary_key=True)
    name = Column(String, default="Novo Agente") # Nome do agente
    description = Column(Text, nullable=True) # Descrição do agente
    model = Column(String, default="gpt-5.2")
    fallback_model = Column(String, nullable=True)  # Modelo de backup
    temperature = Column(Float, default=1.0)  # Controle de criatividade (0-2)
    top_p = Column(Float, default=1.0)  # Controle de diversidade (0-1)
    top_k = Column(Integer, default=40)
    presence_penalty = Column(Float, default=0.0)
    frequency_penalty = Column(Float, default=0.0)
    safety_settings = Column(String, default="standard")
    is_active = Column(Boolean, default=True)  # Status do agente
    date_awareness = Column(Boolean, default=False)  # Consciência temporal (datas reais)
    system_prompt = Column(Text, default="Você é um assistente útil e inteligente.")
    context_window = Column(Integer, default=5)
    knowledge_base = Column(Text, default="[]") # Legacy JSON list of FAQs
    simulated_time = Column(String, nullable=True) # HH:MM for time override
    
    # RAG Settings
    rag_retrieval_count = Column(Integer, default=5) # New: Top-K config
    rag_translation_enabled = Column(Boolean, default=False)
    rag_multi_query_enabled = Column(Boolean, default=False)
    rag_rerank_enabled = Column(Boolean, default=True)
    rag_agentic_eval_enabled = Column(Boolean, default=True)
    rag_parent_expansion_enabled = Column(Boolean, default=True)

    # Security Guardrails
    security_competitor_blacklist = Column(Text, nullable=True) # Ex: "Coca-Cola, Pepsi"
    security_forbidden_topics = Column(Text, nullable=True) # Ex: "Politics, Religion"
    security_discount_policy = Column(Text, nullable=True) # Ex: "Max 10%"
    security_language_complexity = Column(String, default="standard") # standard, simple, technical
    security_pii_filter = Column(Boolean, default=False) # Strip email/cpf?
    security_validator_ia = Column(Boolean, default=False)
    
    # Bot-to-Bot Defense (Anti-Loop)
    security_bot_protection = Column(Boolean, default=False)
    security_max_messages_per_session = Column(Integer, default=20)
    security_semantic_threshold = Column(Float, default=0.85)
    security_loop_count = Column(Integer, default=3)
    
    # UI Customization
    ui_primary_color = Column(String, default="#6366f1")
    ui_header_color = Column(String, default="#0f172a")
    ui_chat_title = Column(String, default="Suporte Inteligente")
    ui_welcome_message = Column(Text, default="Olá! Como posso te ajudar hoje?")
    
    # Cost Router
    router_enabled = Column(Boolean, default=False)
    router_simple_model = Column(String, default="gpt-4o-mini")
    router_simple_fallback_model = Column(String, nullable=True)
    router_complex_model = Column(String, default="gpt-4o")
    router_complex_fallback_model = Column(String, nullable=True)
    inbox_capture_enabled = Column(Boolean, default=True)

    # Response Translation
    response_translation_enabled = Column(Boolean, default=False)
    response_translation_fallback_lang = Column(String, default="portuguese")

    # Legacy FK (Single KB)
    knowledge_base_id = Column(Integer, ForeignKey("knowledge_bases.id", ondelete="SET NULL"), nullable=True)
    linked_knowledge_base = relationship("KnowledgeBaseModel", back_populates="agents")
    
    # New M2M Relationship
    knowledge_bases = relationship("KnowledgeBaseModel", secondary=agent_knowledge_bases, back_populates="linked_agents")
    
    # Relacionamento com as ferramentas selecionadas
    tools = relationship("ToolModel", secondary=agent_tools, back_populates="agents")
    
    # Relacionamento com rascunhos de prompt
    prompt_drafts = relationship("PromptDraftModel", back_populates="agent", cascade="all, delete-orphan")
    
    handoff_enabled = Column(Boolean, default=False) # Permite que este agente use a ferramenta de handoff
    model_settings = Column(Text, default="{}") # JSON store for per-slot configurations (temperature, top_p, etc)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ToolModel(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)
    parameters_schema = Column(Text) # Stored as JSON string
    webhook_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamento reverso com agentes
    agents = relationship("AgentConfigModel", secondary=agent_tools, back_populates="tools")

class PromptDraftModel(Base):
    __tablename__ = "prompt_drafts"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_config.id", ondelete="CASCADE"), nullable=False)
    prompt_text = Column(Text, nullable=False)
    version_name = Column(String, nullable=True) # Ex: "Rascunho de Segunda"
    character_count = Column(Integer, default=0)
    token_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    agent = relationship("AgentConfigModel", back_populates="prompt_drafts")

class UserMemoryModel(Base):
    __tablename__ = "user_memory"

    id = Column(Integer, primary_key=True)
    session_id = Column(String, index=True) # ID da sessão ou WhatsApp do usuário
    key = Column(String, index=True) # Nome do fato (ex: 'nome_cliente', 'objetivo_vida')
    value = Column(Text) # Valor do fato extraído
    confidence = Column(Float, default=1.0) # Nível de certeza da IA
    source_message = Column(Text, nullable=True) # Trecho original para referência
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FeedbackLog(Base):
    """Armazena pares de treinamento para o pipeline de fine-tuning.
    Cada registro representa uma interação avaliada por um humano.
    """
    __tablename__ = "feedback_logs"

    id = Column(Integer, primary_key=True, index=True)
    interaction_log_id = Column(Integer, ForeignKey("interaction_logs.id", ondelete="SET NULL"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agent_config.id", ondelete="CASCADE"), nullable=False)

    # O par de treinamento (matéria-prima do fine-tuning)
    user_message = Column(Text, nullable=False)           # A pergunta do usuário
    original_response = Column(Text, nullable=True)       # O que o agente respondeu (pode ser bom ou ruim)
    corrected_response = Column(Text, nullable=True)      # A resposta ideal definida pelo humano
    system_prompt_snapshot = Column(Text, nullable=True)  # Snapshot do system prompt no momento

    # Classificação do feedback
    rating = Column(String, default="negative")           # 'positive' | 'negative'
    correction_note = Column(Text, nullable=True)         # Nota opcional do revisor

    # Controle do pipeline de exportação e treinamento
    exported_to_finetune = Column(Boolean, default=False)
    finetune_job_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class GoogleTokensModel(Base):
    """Armazena tokens de autenticação do Google Calendar para cada agente."""
    __tablename__ = "google_tokens"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_config.id", ondelete="CASCADE"), unique=True, nullable=True)
    
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_uri = Column(String, default="https://oauth2.googleapis.com/token")
    client_id = Column(String, nullable=True)
    client_secret = Column(String, nullable=True)
    scopes = Column(Text, nullable=True)
    expiry = Column(DateTime, nullable=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent = relationship("AgentConfigModel")

class GlobalContextVariableModel(Base):
    __tablename__ = "global_context_variables"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)
    type = Column(String, default="string") # Novo campo: string, number, boolean
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserModel(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False) # Nota: Em produção usar hashbcryt. Aqui mantemos simples conforme solicitado.
    role = Column(String, default="Usuário") # "Super Admin", "Admin", "Usuário"
    status = Column(String, default="ATIVO") # "ATIVO", "INATIVO"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UnansweredQuestionModel(Base):
    __tablename__ = "unanswered_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_config.id", ondelete="CASCADE"), nullable=True)
    session_id = Column(String, index=True, nullable=True)
    question = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    status = Column(String, default="PENDENTE") # PENDENTE, RESPONDIDA, DESCARTADA
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SupportRequestModel(Base):
    __tablename__ = "support_requests"
    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey("agent_config.id", ondelete="SET NULL"))
    session_id = Column(String, nullable=False)
    user_name = Column(String)
    user_email = Column(String)
    status = Column(String, default="OPEN")
    summary = Column(Text)
    reason = Column(Text)
    extracted_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BackgroundProcessLog(Base):
    __tablename__ = "background_process_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, index=True, nullable=True) # Celery task ID
    process_name = Column(String, nullable=False) # Ex: "Processamento de Vídeo"
    status = Column(String, default="PENDENTE") # PENDENTE, PROCESSANDO, CONCLUIDO, ERRO
    progress = Column(Integer, default=0) # 0 to 100
    details = Column(JSON, default={}) # Configurações, metadados, links para txt/json gerados
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
