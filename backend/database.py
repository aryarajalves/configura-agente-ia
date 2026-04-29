from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Helper to connect to default 'postgres' db to create the new db
async def create_database_if_not_exists(url: str):
    try:
        prefix, db_name = url.rsplit("/", 1)
        target_db_name = db_name
        
        # Tenta conectar no banco padrão para criar o novo
        # Tentamos 'postgres' e depois 'template1' (padrão do PG)
        for maintenance_db in ["postgres", "template1"]:
            try:
                default_db_url = f"{prefix}/{maintenance_db}"
                sys_engine = create_async_engine(default_db_url, isolation_level="AUTOCOMMIT")
                async with sys_engine.connect() as conn:
                    result = await conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname = '{target_db_name}'"))
                    exists = result.scalar()
                    
                    if not exists:
                        print(f"🛠️ Banco de dados '{target_db_name}' não encontrado. Criando via '{maintenance_db}'...")
                        await conn.execute(text(f"CREATE DATABASE {target_db_name}"))
                        print(f"✅ Banco de dados '{target_db_name}' criado com sucesso!")
                    else:
                        print(f"✨ Banco de dados '{target_db_name}' já existe.")
                await sys_engine.dispose()
                return # Sucesso
            except Exception as e:
                print(f"ℹ️ Tentativa via '{maintenance_db}' falhou: {e}")
                continue
                
        print(f"⚠️ Aviso: Todas as tentativas de criar o banco '{target_db_name}' falharam. Verifique se ele já existe.")
    except Exception as e:
        print(f"❌ Erro crítico ao verificar/criar o banco de dados: {e}")

engine = create_async_engine(
    DATABASE_URL, 
    echo=True,
    pool_size=20,          # Mais conex├Áes simultâneas permitidas
    max_overflow=10,       # Capacidade extra para picos de tráfego
    pool_timeout=30,       # Tempo de espera por uma conexão
    pool_recycle=1800,     # Reciclar conexões a cada 30 min para saúde do banco
    pool_pre_ping=True     # Verifica se a conexão está viva antes de usar
)

async_session = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with async_session() as session:
        yield session

async def init_db():
    print("🚀 Iniciando verificação do banco de dados...")
    await create_database_if_not_exists(DATABASE_URL)

    # ✅ PASSO 1: Garantir extensão pgvector
    async with engine.connect() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.commit()
            print("✅ pgvector extension ensured.")
        except Exception as e:
            # Ignora erro de duplicata ou falta de permissão se já existir
            pass

    # ✅ PASSO 2: Criar tabelas (Usamos try para evitar crash se outro worker criar antes)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"ℹ️´©Å Base.metadata.create_all info (provavelmente já criado): {e}")

    # ✅ PASSO 3: Migraç├Áes manuais
    async with engine.connect() as conn:
        try:
            # Lista de comandos SQL de migração para rodar um a um de forma segura
            migrations = [
                "ALTER TABLE global_context_variables ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'string'",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS simulated_time VARCHAR",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
                "ALTER TABLE interaction_logs ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agent_config(id) ON DELETE SET NULL",
                "ALTER TABLE interaction_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR",
                "ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0",
                "ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0",
                "ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS cost_usd FLOAT DEFAULT 0.0",
                "ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS cost_brl FLOAT DEFAULT 0.0",
                "ALTER TABLE prompt_drafts ADD COLUMN IF NOT EXISTS character_count INTEGER DEFAULT 0",
                "ALTER TABLE prompt_drafts ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0",
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'Geral'",
                "ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS embedding vector(1536)",
                "ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS source_metadata TEXT",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS rag_retrieval_count INTEGER DEFAULT 5",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS rag_translation_enabled BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS rag_multi_query_enabled BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS rag_rerank_enabled BOOLEAN DEFAULT TRUE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS rag_agentic_eval_enabled BOOLEAN DEFAULT TRUE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS rag_parent_expansion_enabled BOOLEAN DEFAULT TRUE",
                # Web Browsing & Security
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS web_browsing_enabled BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS web_browsing_scope VARCHAR DEFAULT 'all'",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS web_browsing_rules TEXT",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS security_bot_protection BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS security_max_messages_per_session INTEGER DEFAULT 20",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS security_semantic_threshold FLOAT DEFAULT 0.85",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS security_loop_count INTEGER DEFAULT 3",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS security_pii_filter BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS security_validator_ia BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS router_enabled BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS router_simple_model VARCHAR DEFAULT 'gpt-4o-mini'",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS router_simple_fallback_model VARCHAR",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS router_complex_model VARCHAR DEFAULT 'gpt-4o'",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS router_complex_fallback_model VARCHAR",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS handoff_enabled BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS response_translation_enabled BOOLEAN DEFAULT FALSE",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS response_translation_fallback_lang VARCHAR DEFAULT 'portuguese'",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS top_k INTEGER DEFAULT 40",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS presence_penalty FLOAT DEFAULT 0.0",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS frequency_penalty FLOAT DEFAULT 0.0",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS safety_settings VARCHAR DEFAULT 'standard'",
                "ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS model_settings TEXT DEFAULT '{}'",
                "ALTER TABLE interaction_logs ADD COLUMN IF NOT EXISTS debug_info TEXT",
                "ALTER TABLE global_context_variables ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'string'",
                "ALTER TABLE google_tokens ALTER COLUMN agent_id DROP NOT NULL",
                "CREATE INDEX IF NOT EXISTS idx_ki_fts_pt ON knowledge_items USING GIN(to_tsvector('portuguese', coalesce(question, '') || ' ' || coalesce(answer, '')))",
                "CREATE INDEX IF NOT EXISTS idx_ki_fts_en ON knowledge_items USING GIN(to_tsvector('english', coalesce(question, '') || ' ' || coalesce(answer, '')))",
                "CREATE INDEX IF NOT EXISTS idx_ki_fts_es ON knowledge_items USING GIN(to_tsvector('spanish', coalesce(question, '') || ' ' || coalesce(answer, '')))",
                "CREATE INDEX IF NOT EXISTS idx_ki_fts_simple ON knowledge_items USING GIN(to_tsvector('simple', coalesce(question, '') || ' ' || coalesce(answer, '')))",
                "ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES knowledge_items(id) ON DELETE SET NULL",
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS question_label VARCHAR DEFAULT 'Pergunta'",
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS answer_label VARCHAR DEFAULT 'Resposta'",
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS metadata_label VARCHAR DEFAULT 'Metadado'",
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS kb_type VARCHAR DEFAULT 'qa'",
                "ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS metadata_val TEXT",
                "ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS is_test_session BOOLEAN DEFAULT FALSE",
                "ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS test_report JSONB",
                """
                CREATE TABLE IF NOT EXISTS global_context_variables (
                    id SERIAL PRIMARY KEY,
                    key VARCHAR UNIQUE NOT NULL,
                    value TEXT,
                    type VARCHAR DEFAULT 'string',
                    description TEXT,
                    is_default BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS knowledge_bases (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR UNIQUE DEFAULT 'Nova Base',
                    description TEXT,
                    question_label VARCHAR DEFAULT 'Pergunta',
                    answer_label VARCHAR DEFAULT 'Resposta',
                    metadata_label VARCHAR DEFAULT 'Metadado',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS knowledge_items (
                    id SERIAL PRIMARY KEY,
                    knowledge_base_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
                    question TEXT,
                    answer TEXT,
                    metadata_val TEXT,
                    category VARCHAR DEFAULT 'Geral',
                    source_metadata TEXT,
                    parent_id INTEGER REFERENCES knowledge_items(id) ON DELETE SET NULL
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS session_summaries (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR UNIQUE,
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE CASCADE,
                    summary_text TEXT,
                    input_tokens INTEGER DEFAULT 0,
                    output_tokens INTEGER DEFAULT 0,
                    cost_usd FLOAT DEFAULT 0.0,
                    cost_brl FLOAT DEFAULT 0.0,
                    is_test_session BOOLEAN DEFAULT FALSE,
                    test_report JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS prompt_drafts (
                    id SERIAL PRIMARY KEY,
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE CASCADE,
                    prompt_text TEXT NOT NULL,
                    version_name VARCHAR,
                    character_count INTEGER DEFAULT 0,
                    token_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE CASCADE,
                    knowledge_base_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
                    PRIMARY KEY (agent_id, knowledge_base_id)
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    email VARCHAR UNIQUE NOT NULL,
                    password VARCHAR NOT NULL,
                    role VARCHAR DEFAULT 'Usuário',
                    status VARCHAR DEFAULT 'ATIVO',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS agent_config (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR DEFAULT 'Novo Agente',
                    description TEXT,
                    model VARCHAR DEFAULT 'gpt-4o',
                    fallback_model VARCHAR,
                    temperature FLOAT DEFAULT 1.0,
                    top_p FLOAT DEFAULT 1.0,
                    system_prompt TEXT,
                    context_window INTEGER DEFAULT 5,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS tools (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    description TEXT,
                    config JSONB DEFAULT '{}',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS agent_tools (
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE CASCADE,
                    tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
                    PRIMARY KEY (agent_id, tool_id)
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS interaction_logs (
                    id SERIAL PRIMARY KEY,
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE SET NULL,
                    session_id VARCHAR,
                    user_message TEXT,
                    agent_response TEXT,
                    model_used VARCHAR,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    cost_usd FLOAT,
                    cost_brl FLOAT,
                    handoff_to VARCHAR,
                    debug_info TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS unanswered_questions (
                    id SERIAL PRIMARY KEY,
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE CASCADE,
                    session_id VARCHAR,
                    question TEXT NOT NULL,
                    context TEXT,
                    status VARCHAR DEFAULT 'PENDENTE',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS support_requests (
                    id SERIAL PRIMARY KEY,
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE SET NULL,
                    session_id VARCHAR NOT NULL,
                    user_name VARCHAR,
                    user_email VARCHAR,
                    status VARCHAR DEFAULT 'OPEN',
                    summary TEXT,
                    reason TEXT,
                    extracted_data JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS feedback_logs (
                    id SERIAL PRIMARY KEY,
                    interaction_log_id INTEGER REFERENCES interaction_logs(id) ON DELETE SET NULL,
                    agent_id INTEGER REFERENCES agent_config(id) ON DELETE CASCADE,
                    user_message TEXT NOT NULL,
                    original_response TEXT,
                    corrected_response TEXT,
                    system_prompt_snapshot TEXT,
                    rating VARCHAR DEFAULT 'negative',
                    correction_note TEXT,
                    exported_to_finetune BOOLEAN DEFAULT FALSE,
                    finetune_job_id VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """,
                """
                ALTER TABLE IF EXISTS support_requests ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}'
                """
            ]
            
            for cmd in migrations:
                try:
                    # Rodamos cada migração em uma transação separada para não travar se uma falhar
                    async with engine.begin() as migration_conn:
                        await migration_conn.execute(text(cmd))
                    print(f"✅ Migration success: {cmd}")
                except Exception as ex:
                    print(f"ℹ️´©Å Migration skipped/failed: {cmd}")
                    continue

            # Verify columns after migrations
            res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'interaction_logs';"))
            cols = [r[0] for r in res.fetchall()]
            print(f"📊 Current interaction_logs columns: {cols}")

            res_global = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'global_context_variables';"))
            cols_global = [r[0] for r in res_global.fetchall()]
            print(f"📊 Current global_context_variables columns: {cols_global}")
            
            print("📅 Database check: Migrations processed.")
        except Exception as e:
            print(f"⚠️´©Å Migration warning: {e}")

    # Google Tokens table (Nativa)
    async with engine.connect() as conn:
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS google_tokens (
                    id SERIAL PRIMARY KEY,
                    agent_id INTEGER UNIQUE REFERENCES agent_config(id) ON DELETE CASCADE,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_uri VARCHAR DEFAULT 'https://oauth2.googleapis.com/token',
                    client_id VARCHAR,
                    client_secret VARCHAR,
                    scopes TEXT,
                    expiry TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            await conn.commit()
        except: pass

    # User Memory table (Nativa)
    async with engine.connect() as conn:
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_memory (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR,
                    key VARCHAR,
                    value TEXT,
                    confidence FLOAT DEFAULT 1.0,
                    source_message TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_memory_session ON user_memory (session_id)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_memory_key ON user_memory (key)"))
            await conn.commit()
        except: pass
    print("✅ Database check complete.")
