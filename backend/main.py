from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Security, Request, Response
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from typing import Any, List, Dict, Optional
from config_store import AgentConfig, KnowledgeBase, KnowledgeItem, MODEL_INFO, USD_TO_BRL
from agent import process_message, summarize_history, extract_questions_from_history, get_openai_client, INTERNAL_CTX_KEYS
from rag_service import calculate_coverage, get_embedding, get_batch_embeddings
from database import init_db, get_db, async_session
from models import InteractionLog, AgentConfigModel, ToolModel, KnowledgeBaseModel, KnowledgeItemModel, SessionSummary, PromptDraftModel, FeedbackLog, GlobalContextVariableModel, UserModel, UnansweredQuestionModel, SupportRequestModel
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import json
import os
import time
from smart_importer import extract_text_from_pdf, chunk_text, generate_qa_from_text, generate_global_qa
import logging
import asyncio
from router_import import router as import_router
from transcription_service import transcribe_video
import tempfile
import tiktoken
from jose import JWTError, jwt
from passlib.context import CryptContext
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# --- CONFIGURA├ç├òES DE SEGURAN├çA ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "727ff2d0094a40d08be33a6eda9e3751") # Use uma chave forte no .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
limiter = Limiter(key_func=get_remote_address, enabled=os.getenv("TESTING", "false").lower() != "true")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def mask_sensitive_data(data: str) -> str:
    if not data: return data
    if "@" in data: # Email
        parts = data.split("@")
        return f"{parts[0][:2]}***@{parts[1]}"
    return f"{data[:2]}***" if len(data) > 2 else "***"

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Usar o valor configurado em ACCESS_TOKEN_EXPIRE_MINUTES (agora 24h)
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Configuração de Logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def get_current_user(token: str = Depends(APIKeyHeader(name="Authorization", auto_error=False))):
    if not token:
        logger.warning("AUTH: Token ausente na requisição")
        raise HTTPException(status_code=401, detail="Token ausente")
    try:
        # Remover 'Bearer ' se presente
        if token.startswith("Bearer "):
            token = token[7:]
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_email: str = payload.get("sub")
        
        if user_email is None:
            logger.warning("AUTH: Payload do token sem 'sub'")
            raise HTTPException(status_code=401, detail="Token inválido")
            
        return user_email
    except JWTError as e:
        logger.warning(f"AUTH: Falha na validação do JWT: {str(e)}")
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

from prompt_lab import router as prompt_lab_router
from session_analysis import router as analysis_router
from google_calendar import GoogleCalendarService
from models import GoogleTokensModel

# --- API KEY AUTHENTICATION ---
_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(_API_KEY_HEADER)):
    """Dependência que valida a API Key enviada no header X-API-Key."""
    expected = os.getenv("AGENT_API_KEY", "")
    if not expected:
        return
    if api_key != expected:
        logger.warning(f"AUTH: API Key inválida! Recebida: {api_key[:5]}...")
        raise HTTPException(
            status_code=403,
            detail="API Key inválida ou ausente. Envie o header X-API-Key correto."
        )

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="AI Agent API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

class LoginRequest(BaseModel):
    email: str
    password: str

class TranscriptionProcessRequest(BaseModel):
    text: str
    config: Dict[str, Any]

class BatchUpdateRequest(BaseModel):
    item_ids: List[int]
    question: Optional[str] = None
    answer: Optional[str] = None
    metadata_val: Optional[str] = None
    category: Optional[str] = None

class BulkSummarizeRequest(BaseModel):
    item_ids: List[int]
    question: str
    metadata_val: str
    category: str = "Geral"

class UserCreate(BaseModel):
    name: str = "Novo Usuário"
    email: str
    password: str
    role: str = "Usuário"
    status: str = "ATIVO"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

@app.get("/users/me", dependencies=[Depends(verify_api_key)])
async def get_me(current_email: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserModel).where(UserModel.email == current_email))
    user = result.scalar_one_or_none()
    if not user:
        # Fallback para admin fixo do .env caso não esteja no banco
        from dotenv import dotenv_values
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        env_vars = dotenv_values(env_path) if os.path.exists(env_path) else {}
        admin_email = env_vars.get("ADMIN_EMAIL") or os.getenv("ADMIN_EMAIL") or "admin@agente.com"
        
        if current_email == admin_email:
            return {"id": 0, "name": "Admin Super", "email": admin_email, "role": "Super Admin"}
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@app.put("/users/me", dependencies=[Depends(verify_api_key)])
async def update_me(user_update: UserUpdate, current_email: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserModel).where(UserModel.email == current_email))
    user = result.scalar_one_or_none()
    
    # Identificar se é o Super Admin fixo do .env
    from dotenv import dotenv_values
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    env_vars = dotenv_values(env_path) if os.path.exists(env_path) else {}
    admin_email = env_vars.get("ADMIN_EMAIL") or os.getenv("ADMIN_EMAIL") or "admin@agente.com"
    is_env_admin = (current_email == admin_email)

    if not user:
        if is_env_admin:
            # Se for o Admin do .env e não estiver no banco, criamos o registro básico
            admin_pass = env_vars.get("ADMIN_PASSWORD") or os.getenv("ADMIN_PASSWORD") or "admin123"
            user = UserModel(
                name=user_update.name or "Admin Super",
                email=admin_email,
                password=get_password_hash(admin_pass),
                role="Super Admin",
                status="ATIVO"
            )
            db.add(user)
        else:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Regra: Se for Super Admin, só permite atualizar o NOME.
    if is_env_admin or (user and user.role == "Super Admin"):
        if "name" in update_data:
            user.name = update_data["name"]
        # Ignora e-mail e senha silenciosamente ou retorna erro se tentarem forçar
    else:
        # Se for usuário comum, permite atualizar tudo solicitado
        if "password" in update_data and update_data["password"]:
            update_data["password"] = get_password_hash(update_data["password"])
            
        for key, value in update_data.items():
            if value is not None:
                setattr(user, key, value)
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": user.status
    }

@app.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Uso de dotenv_values para ler o arquivo diretamente sem cache do OS
    from dotenv import dotenv_values
    import os
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    
    env_vars = {}
    if os.path.exists(env_path):
        env_vars = dotenv_values(env_path)

    admin_email = env_vars.get("ADMIN_EMAIL") or os.getenv("ADMIN_EMAIL") or "admin@agente.com"
    admin_password = env_vars.get("ADMIN_PASSWORD") or os.getenv("ADMIN_PASSWORD") # Se não tiver, falha
    
    # Check fixed admin from env
    if admin_email and admin_password:
        # Se a senha no env for plain text (pode ser o caso do usuário), verificamos direta
        if req.email == admin_email:
            # Tenta verificar se a senha enviada bate com a do env (pode ser hash ou plain dependendo de como o usuário configurou)
            if req.password == admin_password:
                access_token = create_access_token(data={"sub": admin_email})
                return {"success": True, "token": access_token, "user": {"name": "Admin Super", "role": "Super Admin"}}

    # Busca em banco
    try:
        result = await db.execute(select(UserModel).where(UserModel.email == req.email))
        db_user = result.scalar_one_or_none()
        if db_user:
            # Verificamos hash ou plain (para migração suave)
            is_valid = False
            if db_user.password.startswith("$2b$") or db_user.password.startswith("$2a$"):
                is_valid = verify_password(req.password, db_user.password)
            else:
                is_valid = (db_user.password == req.password)
                # Opcional: Auto-migrar para hash
                if is_valid:
                    db_user.password = get_password_hash(req.password)
                    await db.commit()
            
            if is_valid:
                access_token = create_access_token(data={"sub": db_user.email})
                return {"success": True, "token": access_token, "user": {"name": db_user.name, "role": db_user.role, "id": db_user.id}}
    except Exception as e:
        logger.error(f"Erro no login ao acessar DB: {e}")

    raise HTTPException(status_code=401, detail="Email ou senha incorretos")

# --- USER MANAGEMENT ROUTES ---
@app.get("/users", dependencies=[Depends(verify_api_key), Depends(get_current_user)])
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserModel).order_by(UserModel.id.desc()))
    users = result.scalars().all()
    return users

@app.post("/users", dependencies=[Depends(verify_api_key), Depends(get_current_user)])
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    user_data = user.model_dump()
    user_data["password"] = get_password_hash(user.password)
    db_user = UserModel(**user_data)
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@app.put("/users/{user_id}", dependencies=[Depends(verify_api_key), Depends(get_current_user)])
async def update_user(user_id: int, user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    update_data = user.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password"] = get_password_hash(update_data["password"])
        
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    await db.commit()
    await db.refresh(db_user)
    return db_user

@app.delete("/users/{user_id}", dependencies=[Depends(verify_api_key), Depends(get_current_user)])
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    await db.delete(db_user)
    await db.commit()
    return {"success": True}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"ERRO GLOBAL CAPTURADO: {str(exc)}", exc_info=True)
    return Response(
        content=json.dumps({"detail": "Erro interno no servidor", "error": str(exc)}),
        status_code=500,
        media_type="application/json"
    )

# Configuração de CORS Restrito
raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
cors_origins = [o.strip() for o in raw_origins if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
async def ping():
    return {"status": "ok", "message": "Backend is reachable"}

from background_tasks import router as background_tasks_router

app.include_router(import_router)
app.include_router(prompt_lab_router)
app.include_router(analysis_router)
app.include_router(background_tasks_router)

# Servir arquivos do Widget (JS e CSS)
app.mount("/static", StaticFiles(directory="widget"), name="static")

class MessageRequest(BaseModel):
    message: str
    session_id: str | None = None
    agent_id: int | None = None # Optional: Identify which agent to use
    context_variables: Dict[str, Any] | None = None # Variables passed via API (e.g. phone, user_id)
    model_override: str | None = None # NEW: For Arena A/B Testing
    system_prompt_override: str | None = None # NEW: For Arena A/B Testing

class ToolCreate(BaseModel):
    name: str
    description: str
    parameters_schema: str  # JSON string
    webhook_url: str | None = None

class PromptDraft(BaseModel):
    id: int | None = None
    agent_id: int | None = None
    prompt_text: str
    version_name: str | None = None
    character_count: int | None = 0
    token_count: int | None = 0
    created_at: datetime | None = None

    class Config:
        orm_mode = True
        from_attributes = True

class GlobalContextVariable(BaseModel):
    id: int | None = None
    key: str
    value: str | None = None
    type: str | None = "string"
    description: str | None = None
    is_default: bool | None = False

    class Config:
        from_attributes = True

class ToolResponse(ToolCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class DashboardStats(BaseModel):
    total_agents: int
    total_knowledge_bases: int
    total_interactions: int
    total_cost: float

    class Config:
        orm_mode = True
        from_attributes = True

class FinancialReportItem(BaseModel):
    date: str
    agent_id: int | None
    agent_name: str | None
    total_messages: int
    total_tokens: int
    total_cost: float
    avg_cost_per_message: float
    unique_sessions: int

class FinancialReport(BaseModel):
    items: List[FinancialReportItem]
    grand_total_cost: float

class MessageResponse(BaseModel):
    response: str
    cost_usd: float
    cost_brl: float
    input_tokens: int
    output_tokens: int
    tool_calls: List[Dict[str, Any]] | None = None # Return tool calls if any
    audio: str | None = None # Base64 audio string if generated
    handoff_data: Dict[str, Any] | None = None
    debug: Dict[str, Any] | None = None
    response_time_ms: int | None = None
    model_used: str | None = None
    error: bool = False

class LoginRequest(BaseModel):
    email: str
    password: str

async def get_active_config(db: AsyncSession, agent_id: int | None = None) -> AgentConfigModel:
    if agent_id:
        result = await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == agent_id))
        config = result.scalars().first()
        if config:
            return config
            
    result = await db.execute(select(AgentConfigModel).limit(1))
    config = result.scalars().first()
    if not config:
        # Create default if not exists
        default_config = AgentConfig() # Pydantic default
        config = AgentConfigModel(
            model=default_config.model,
            fallback_model=default_config.fallback_model,
            temperature=default_config.temperature,
            top_p=default_config.top_p,
            date_awareness=default_config.date_awareness,
            system_prompt=default_config.system_prompt,
            context_window=default_config.context_window,
            knowledge_base="[]"
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config

@app.get("/models", dependencies=[Depends(verify_api_key)])
async def list_models():
    from config_store import discover_models
    # Busca modelos reais das APIs (com cache de 1h)
    discovered = discover_models()
    return {
        "openai_connected": bool(os.getenv("OPENAI_API_KEY")),
        "gemini_connected": bool(os.getenv("GEMINI_API_KEY")),
        "models": [
            {
                "id": m["id"],
                "real_id": m["real_id"],
                "supports_tools": m["supports_tools"],
                "supports_temperature": m["supports_temperature"],
                "input": m.get("input", 0),
                "output": m.get("output", 0),
                "context_window": m.get("context_window", "Unknown"),
                "provider": m.get("provider", "openai"),
                "available_versions": m.get("available_versions", [])
            }
            for m in discovered
        ]
    }

# --- INTEGRATIONS: GOOGLE CALENDAR ---
@app.get("/integrations/google/auth-url", dependencies=[Depends(verify_api_key)])
async def get_google_auth_url(agent_id: int | None = None, db: AsyncSession = Depends(get_db)):
    service = GoogleCalendarService(agent_id, db)
    auth_url = await service.get_auth_url()
    return {"auth_url": auth_url}

@app.get("/integrations/google/callback")
async def google_callback(code: str, state: str | None = None, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    if not state:
        raise HTTPException(status_code=400, detail="Missing state (agent_id)")
    
    try:
        if state == 'global':
            agent_id = None
            redirect_path = "/integrations"
        else:
            agent_id = int(state)
            redirect_path = f"/agents/{agent_id}?tab=integracoes"
            
        service = GoogleCalendarService(agent_id, db)
        await service.save_tokens(code)
        
        # Redireciona de volta para a tela de integraç├Áes (global ou do agente)
        # Em produção, deve redirecionar para a URL do seu Frontend
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5300").rstrip('/')
        return RedirectResponse(url=f"{frontend_url}{redirect_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/integrations/google/status", dependencies=[Depends(verify_api_key)])
async def get_google_status(agent_id: int | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GoogleTokensModel).where(GoogleTokensModel.agent_id == agent_id))
    token = result.scalars().first()
    return {"connected": token is not None}

# --- KNOWLEDGE BASE ENDPOINTS ---
@app.get("/knowledge-bases", response_model=List[KnowledgeBase], dependencies=[Depends(verify_api_key)])
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).options(selectinload(KnowledgeBaseModel.items)))
    return result.scalars().all()

@app.post("/knowledge-bases", response_model=KnowledgeBase, dependencies=[Depends(verify_api_key)])
async def create_knowledge_base(kb: KnowledgeBase, db: AsyncSession = Depends(get_db)):
    # Check for duplicate name
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.name == kb.name))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Já existe uma base de conhecimento com este nome.")

    db_kb = KnowledgeBaseModel(name=kb.name, description=kb.description, kb_type=kb.kb_type)
    db.add(db_kb)
    await db.commit()
    await db.refresh(db_kb)
    return KnowledgeBase(
        id=db_kb.id,
        name=db_kb.name,
        description=db_kb.description,
        kb_type=db_kb.kb_type,
        question_label=db_kb.question_label,
        answer_label=db_kb.answer_label,
        metadata_label=db_kb.metadata_label,
        items=[],
        updated_at=db_kb.updated_at
    )

@app.get("/knowledge-bases/{kb_id}", response_model=KnowledgeBase, dependencies=[Depends(verify_api_key)])
async def get_knowledge_base(kb_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeBaseModel)
        .where(KnowledgeBaseModel.id == kb_id)
        .options(selectinload(KnowledgeBaseModel.items))
    )
    kb = result.scalars().first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    return kb

@app.put("/knowledge-bases/{kb_id}", response_model=KnowledgeBase, dependencies=[Depends(verify_api_key)])
async def update_knowledge_base(kb_id: int, kb: KnowledgeBase, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    db_kb = result.scalars().first()
    if not db_kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    
    # Check for duplicate name (excluding itself)
    if db_kb.name != kb.name:
        result_name = await db.execute(
            select(KnowledgeBaseModel).where(KnowledgeBaseModel.name == kb.name)
        )
        if result_name.scalars().first():
            raise HTTPException(status_code=400, detail="Já existe uma base de conhecimento com este nome.")

    db_kb.name = kb.name
    db_kb.description = kb.description
    db_kb.kb_type = kb.kb_type
    db_kb.question_label = kb.question_label
    db_kb.answer_label = kb.answer_label
    db_kb.metadata_label = kb.metadata_label
    await db.commit()
    await db.refresh(db_kb)
    
    # Recarrega com items para garantir que o response_model seja satisfeito
    result = await db.execute(
        select(KnowledgeBaseModel)
        .where(KnowledgeBaseModel.id == kb_id)
        .options(selectinload(KnowledgeBaseModel.items))
    )
    db_kb = result.scalars().first()
    
    return KnowledgeBase(
        id=db_kb.id,
        name=db_kb.name,
        description=db_kb.description,
        kb_type=db_kb.kb_type,
        question_label=db_kb.question_label,
        answer_label=db_kb.answer_label,
        metadata_label=db_kb.metadata_label,
        items=[KnowledgeItem.from_orm(i) for i in db_kb.items],
        updated_at=db_kb.updated_at
    )

@app.delete("/knowledge-bases/{kb_id}", dependencies=[Depends(verify_api_key)])
async def delete_knowledge_base(kb_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb = result.scalars().first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    await db.delete(kb)
    await db.commit()
    return {"message": "Knowledge Base deleted"}

# --- KNOWLEDGE ITEM ENDPOINTS ---
@app.post("/knowledge-bases/{kb_id}/items", response_model=KnowledgeItem, dependencies=[Depends(verify_api_key)])
async def add_knowledge_item(kb_id: int, item: KnowledgeItem, db: AsyncSession = Depends(get_db)):
    emb, _ = await get_embedding(item.question)
    db_item = KnowledgeItemModel(
        knowledge_base_id=kb_id, 
        question=item.question, 
        answer=item.answer,
        metadata_val=item.metadata_val,
        category=item.category,
        embedding=emb
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

@app.delete("/knowledge-items/{item_id}", dependencies=[Depends(verify_api_key)])
async def delete_knowledge_item(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeItemModel).where(KnowledgeItemModel.id == item_id))
    item = result.scalars().first()
    if item:
        await db.delete(item)
        await db.commit()
    return {"message": "Item deleted"}

@app.put("/knowledge-items/{item_id}", response_model=KnowledgeItem, dependencies=[Depends(verify_api_key)])
async def update_knowledge_item(item_id: int, item: KnowledgeItem, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeItemModel).where(KnowledgeItemModel.id == item_id))
    db_item = result.scalars().first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if db_item.question != item.question:
        emb, _ = await get_embedding(item.question)
        db_item.embedding = emb

    db_item.question = item.question
    db_item.answer = item.answer
    db_item.metadata_val = item.metadata_val
    db_item.category = item.category
    await db.commit()
    await db.refresh(db_item)
    return db_item

@app.post("/knowledge-bases/{kb_id}/items/bulk", dependencies=[Depends(verify_api_key)])
async def bulk_knowledge_items(kb_id: int, items: List[KnowledgeItem], db: AsyncSession = Depends(get_db)):
    # Delete existing items for a full refresh OR we could do a smart merge
    # For now, let's do a smart update: items with ID are updated, without are created
    # Items NOT in the list are deleted (Sync Mode)
    
    # 1. Get existing IDs
    result = await db.execute(select(KnowledgeItemModel).where(KnowledgeItemModel.id.in_([i.id for i in items if i.id])))
    existing_items = {i.id: i for i in result.scalars().all()}
    
    final_items = []
    
    # 2. Update or Create
    for item in items:
        if item.id in existing_items:
            db_item = existing_items[item.id]
            db_item.question = item.question
            db_item.answer = item.answer
            db_item.metadata_val = item.metadata_val
            db_item.category = item.category
            final_items.append(db_item)
        else:
            emb, _ = await get_embedding(item.question)
            new_item = KnowledgeItemModel(
                knowledge_base_id=kb_id,
                question=item.question,
                answer=item.answer,
                metadata_val=item.metadata_val,
                category=item.category,
                embedding=emb
            )
            db.add(new_item)
            final_items.append(new_item)
            
    # 3. Handle Deletions (Items that were in DB but not in current list)
    # Get all current IDs in DB for this KB
    res_all = await db.execute(select(KnowledgeItemModel.id).where(KnowledgeItemModel.knowledge_base_id == kb_id))
    all_db_ids = set(res_all.scalars().all())
    provided_ids = {i.id for i in items if i.id}
    ids_to_delete = all_db_ids - provided_ids
    
    if ids_to_delete:
        from sqlalchemy import delete
        await db.execute(delete(KnowledgeItemModel).where(KnowledgeItemModel.id.in_(list(ids_to_delete))))

    await db.commit()
    return {"message": "Knowledge base synced successfully", "count": len(items)}

class BatchDeleteRequest(BaseModel):
    item_ids: List[int]

@app.delete("/knowledge-bases/{kb_id}/items/batch-delete", dependencies=[Depends(verify_api_key)])
async def batch_delete_items(kb_id: int, request: BatchDeleteRequest, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import delete
    if not request.item_ids:
        return {"message": "No items to delete"}
        
    await db.execute(
        delete(KnowledgeItemModel)
        .where(
            KnowledgeItemModel.knowledge_base_id == kb_id,
            KnowledgeItemModel.id.in_(request.item_ids)
        )
    )
    await db.commit()
    return {"message": f"Deleted {len(request.item_ids)} items"}

@app.put("/knowledge-bases/{kb_id}/items/batch-update", dependencies=[Depends(verify_api_key)])
async def batch_update_items(kb_id: int, request: BatchUpdateRequest, db: AsyncSession = Depends(get_db)):
    if not request.item_ids:
        return {"message": "No items to update"}
    
    result = await db.execute(
        select(KnowledgeItemModel).where(
            KnowledgeItemModel.knowledge_base_id == kb_id,
            KnowledgeItemModel.id.in_(request.item_ids)
        )
    )
    items = result.scalars().all()
    
    if not items:
        raise HTTPException(status_code=404, detail="No items found to update")

    updated_count = 0
    items_to_reembed = []
    for item in items:
        changed_embedding = False
        if request.question is not None:
            item.question = request.question
            changed_embedding = True
        if request.answer is not None:
            item.answer = request.answer
            changed_embedding = True
        if request.metadata_val is not None:
            item.metadata_val = request.metadata_val
            changed_embedding = True
        if request.category is not None:
            item.category = request.category
            
        if changed_embedding:
            items_to_reembed.append(item)
        updated_count += 1

    # Process re-embedding in batches of 100
    batch_size = 100
    for i in range(0, len(items_to_reembed), batch_size):
        batch = items_to_reembed[i:i+batch_size]
        texts = [f"{it.metadata_val} | {it.question} | {it.answer}" for it in batch]
        embeddings, _ = await get_batch_embeddings(texts)
        for j, item in enumerate(batch):
            if embeddings and j < len(embeddings):
                item.embedding = embeddings[j]

    await db.commit()
    return {"message": f"Updated {updated_count} items"}

@app.post("/knowledge-bases/{kb_id}/items/bulk-summarize", dependencies=[Depends(verify_api_key)])
async def bulk_summarize_items(kb_id: int, request: BulkSummarizeRequest, db: AsyncSession = Depends(get_db)):
    if not request.item_ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos 1 item para resumir.")
    
    # 1. Busca o conteúdo dos itens selecionados
    result = await db.execute(
        select(KnowledgeItemModel).where(
            KnowledgeItemModel.knowledge_base_id == kb_id,
            KnowledgeItemModel.id.in_(request.item_ids)
        )
    )
    items = result.scalars().all()
    
    if not items:
        raise HTTPException(status_code=404, detail="Itens não encontrados para resumir.")

    # 2. Prepara contexto para o LLM
    context = ""
    for i, item in enumerate(items):
        context += f"ITEM {i+1}:\nPergunta/Título: {item.question}\nConteúdo: {item.answer}\nMetadado: {item.metadata_val}\n\n"
        
    prompt = f"""
Você é um assistente especialista em síntese de conhecimento. 
Recebi múltiplos fragmentos de informação (perguntas/respostas/tópicos) e sua missão é criar um RESUMO EXECUTIVO e COMPLETO que sintetize todos eles.

CONTEÚDOS PARA RESUMIR:
{context}

INSTRUÇÕES:
1. Comece direto no resumo, sem introduções como "Aqui está o resumo".
2. Organize as informações de forma lógica (ex: use tópicos se apropriado).
3. Seja denso em informações: não perca detalhes importantes dos itens originais.
4. O tom deve ser profissional e instrutivo.
5. Responda em Português do Brasil.
"""
    try:
        from rag_service import call_rag_llm
        llm_response = await call_rag_llm(
            messages=[{"role": "user", "content": prompt}]
        )
        summary_text = llm_response.choices[0].message.content

        # 3. Cria o novo item
        # Texto para embedding deve conter metadados para facilitar perguntas como "qual modulo"
        new_meta = request.metadata_val
        text_to_embed = f"{new_meta} | {request.question} | {summary_text}"
        emb, _ = await get_embedding(text_to_embed)
        
        db_item = KnowledgeItemModel(
            knowledge_base_id=kb_id,
            question=request.question,
            answer=summary_text,
            metadata_val=new_meta,
            category=request.category,
            embedding=emb
        )
        db.add(db_item)
        await db.commit()
        await db.refresh(db_item)
        
        return {"message": "Resumo gerado e salvo com sucesso!", "item_id": db_item.id}
        
    except Exception as e:
        logger.error(f"Erro ao gerar resumo em massa: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/knowledge-bases/{kb_id}/duplicates", dependencies=[Depends(verify_api_key)])
async def find_kb_duplicates(kb_id: int, semantic: bool = False, db: AsyncSession = Depends(get_db)):
    """Encontra grupos de itens idênticos ou semânticos na base."""
    from sqlalchemy import func, cast, String, text
    
    try:
        # 1. Busca Duplicatas EXATAS (Sempre fazemos para garantir segurança total)
        q_norm = func.lower(func.trim(KnowledgeItemModel.question))
        a_norm = func.lower(func.trim(KnowledgeItemModel.answer))
        
        exact_stmt = (
            select(
                q_norm.label("q_clean"),
                a_norm.label("a_clean"),
                func.count(KnowledgeItemModel.id).label("count"),
                func.array_agg(KnowledgeItemModel.id).label("ids")
            )
            .where(KnowledgeItemModel.knowledge_base_id == kb_id)
            .group_by(q_norm, a_norm)
            .having(func.count(KnowledgeItemModel.id) > 1)
        )
        exact_res = await db.execute(exact_stmt)
        
        # Mapa para consolidar grupos final: {set_of_ids: group_info}
        # Para evitar que IDs que são duplicatas exatas apareçam sozinhas E em grupos semânticos repetidamente
        final_groups = []
        covered_ids = set()

        # Processa as exatas primeiro
        for row in exact_res.all():
            g_ids = list(row[3])
            sample_id = g_ids[0]
            sample_item = await db.get(KnowledgeItemModel, sample_id)
            
            final_groups.append({
                "question": sample_item.question,
                "answer": sample_item.answer,
                "count": len(g_ids),
                "ids": g_ids,
                "is_semantic": False
            })
            covered_ids.update(g_ids)

        # 2. Se modo SEMÂNTICO, busca pares similares e agrupa os que não foram cobertos ou cria super-grupos
        if semantic:
            threshold = 0.93
            # Query de pares similaridade (SQL para eficiência)
            pairs_stmt = text("""
                SELECT a.id, b.id 
                FROM knowledge_items a 
                JOIN knowledge_items b ON a.id < b.id 
                WHERE a.knowledge_base_id = :kb_id AND b.knowledge_base_id = :kb_id 
                AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
                AND 1 - (a.embedding <=> b.embedding) > :threshold
            """).bindparams(kb_id=kb_id, threshold=threshold)
            
            pairs_res = await db.execute(pairs_stmt)
            pairs = pairs_res.all()
            
            if pairs:
                # Grafo de adjacências
                adj = {}
                for id1, id2 in pairs:
                    if id1 not in adj: adj[id1] = []
                    if id2 not in adj: adj[id2] = []
                    adj[id1].append(id2)
                    adj[id2].append(id1)
                
                visited = set()
                # Precisamos de todos os dados dos itens para exibir (carregamos em cache)
                items_stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb_id)
                items_res = await db.execute(items_stmt)
                all_items_cache = {i.id: i for i in items_res.scalars().all()}

                for start_id in adj:
                    if start_id in visited: continue
                    
                    # BFS
                    group_ids = []
                    queue = [start_id]
                    visited.add(start_id)
                    while queue:
                        curr = queue.pop(0)
                        group_ids.append(curr)
                        for neighbor in adj.get(curr, []):
                            if neighbor not in visited:
                                visited.add(neighbor)
                                queue.append(neighbor)
                    
                    # Verifica se este grupo semântico já está contido nas duplicatas exatas
                    # Se não estiver, ou se for Maior que as exatas, adicionamos
                    # Para simplificar: adicionamos se houver pelo menos um ID novo não coberto pelas exatas
                    if any(id_ not in covered_ids for id_ in group_ids):
                        sample = all_items_cache.get(group_ids[0])
                        final_groups.append({
                            "question": sample.question if sample else "Item Similar",
                            "answer": sample.answer if sample else "",
                            "count": len(group_ids),
                            "ids": group_ids,
                            "is_semantic": True
                        })
            
        return {"duplicates": final_groups}
    except Exception as e:
        logger.error(f"Erro ao buscar duplicados na KB {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno do banco: {str(e)}")

class MergeItemsRequest(BaseModel):
    item_ids: List[int]

@app.post("/knowledge-bases/{kb_id}/propose-merge", dependencies=[Depends(verify_api_key)])
async def propose_kb_merge(kb_id: int, request: MergeItemsRequest, db: AsyncSession = Depends(get_db)):
    """Usa IA para sintetizar múltiplos itens duplicados em um único conteúdo superior."""
    if len(request.item_ids) < 2:
        raise HTTPException(status_code=400, detail="Selecione ao menos 2 itens para mesclar.")
        
    try:
        # 1. Busca os conteúdos originais
        stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.id.in_(request.item_ids))
        res = await db.execute(stmt)
        items = res.scalars().all()
        
        if not items:
            raise HTTPException(status_code=404, detail="Itens não encontrados.")
            
        # 2. Prepara contexto para o LLM
        context = ""
        for i, item in enumerate(items):
            context += f"VARIANTE {i+1}:\nPergunta: {item.question}\nResposta: {item.answer}\n\n"
            
        prompt = f"""
Sua tarefa é agir como um editor especialista em base de conhecimento.
Recebi múltiplos itens que são semanticamente parecidos ou duplicados. 
Sua missão é criar uma ÚNICA versão que seja a melhor de todas, garantindo que NENHUMA informação importante contida em qualquer uma das variantes seja perdida.

VARIANTES RECEBIDAS:
{context}

INSTRUÇÕES:
1. Sintetize tudo em 1 Pergunta e 1 Resposta.
2. Se houver detalhes extras em uma variante que não existem na outra, inclua na resposta final.
3. Use um tom profissional e direto.
4. Responda APENAS com um objeto JSON.

EXEMPLO DE RESPOSTA:
{{
  "question": "Pergunta unificada aqui",
  "answer": "Resposta completa e sintetizada aqui"
}}
"""
        from rag_service import call_rag_llm
        response = await call_rag_llm(
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        data = json.loads(response.choices[0].message.content)
        return {"proposed": data, "original_ids": request.item_ids}
        
    except Exception as e:
        logger.error(f"Erro ao propor mesclagem: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RAGSimulationRequest(BaseModel):
    query: str
    translation_enabled: bool = False
    multi_query_enabled: bool = False
    rerank_enabled: bool = False
    agentic_eval_enabled: bool = False
    parent_expansion_enabled: bool = False
    limit: int = 5

@app.post("/knowledge-bases/{kb_id}/simulate-rag", dependencies=[Depends(verify_api_key)])
async def simulate_rag(kb_id: int, request: RAGSimulationRequest, db: AsyncSession = Depends(get_db)):
    from rag_service import search_knowledge_base
    
    # We pass the default model since it's a simulation, or we could pass the agent's if we had it,
    # but the simulator is isolated per KB.
    items, usage = await search_knowledge_base(
        db=db,
        query=request.query,
        kb_id=kb_id,
        limit=request.limit,
        model="gpt-4o-mini",
        fallback_model="gpt-4o-mini",
        force_translation=request.translation_enabled,
        force_multi_query=request.multi_query_enabled,
        force_rerank=request.rerank_enabled,
        force_agentic_eval=request.agentic_eval_enabled,
        force_parent_expansion=request.parent_expansion_enabled
    )
    
    return {
        "items": items,
        "usage": {
            "prompt_tokens": usage.prompt_tokens if usage else 0,
            "completion_tokens": usage.completion_tokens if usage else 0
        }
    }

# --- EXTRACTION LOGIC ---

async def extract_text_from_pdf(content: bytes):
    import io
    import pdfplumber
    text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text

async def extract_text_from_docx(content: bytes):
    import io
    from docx import Document
    doc = Document(io.BytesIO(content))
    return "\n".join([p.text for p in doc.paragraphs])

@app.post("/knowledge-bases/{kb_id}/upload", dependencies=[Depends(verify_api_key)])
async def upload_kb_file(kb_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    filename = file.filename.lower()
    
    text = ""
    if filename.endswith(".pdf"):
        text = await extract_text_from_pdf(content)
    elif filename.endswith(".docx"):
        text = await extract_text_from_docx(content)
    else:
        text = content.decode("utf-8", errors="ignore")

    # Simple logic to split text into Q&A or just chunks
    # For now, let's create chunks of text as "Knowledge Items"
    # We could use AI to summarize or extract Q&A, but let's do a smart chunking
    lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 20]
    
    for line in lines:
        # If it looks like a question or key point, add it
        db_item = KnowledgeItemModel(
            knowledge_base_id=kb_id,
            question=f"Informação de {file.filename}",
            answer=line,
            category="Upload"
        )
        db.add(db_item)
    
    await db.commit()
    return {"message": f"Extraído {len(lines)} itens do arquivo {file.filename}"}

@app.post("/knowledge-bases/transcribe", dependencies=[Depends(verify_api_key)])
async def transcribe_video_endpoint(
    file: UploadFile = File(...),
    config: str = Form("{}") # Recebido como string JSON do FormData
):
    """
    Recebe um arquivo de vídeo/áudio e configurações, transcreve via AssemblyAI.
    """
    try:
        config_dict = json.loads(config)
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            result = transcribe_video(tmp_path, config_dict)
            text = result["text"]
            duration = result["duration"]
            
            # Se a sumarização foi solicitada, anexa ao texto principal
            # No result do AssemblyAI com sumarização, costuma vir no transcript.summary
            # Mas como simplificamos a função de service, vamos garantir que o texto venha completo
            
            # Cálculo de Tokens
            try:
                encoding = tiktoken.get_encoding("cl100k_base")
                tokens = len(encoding.encode(text))
            except:
                tokens = len(text.split()) * 1.3 # Fallback simples
                
            # Custo: ~$0.37/hora -> $0.0001027/segundo
            cost_usd = duration * 0.0001027
            
            return {
                "text": text,
                "duration": round(duration, 2),
                "tokens": tokens,
                "cost_usd": round(cost_usd, 4)
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        logger.error(f"Erro no endpoint de transcrição: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/knowledge-bases/{kb_id}/process-transcription", dependencies=[Depends(verify_api_key)])
async def process_transcription_endpoint(
    kb_id: int,
    request: TranscriptionProcessRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Processa o texto transcrito de acordo com as configurações RAG.
    """
    text = request.text
    config = request.config
    metadata_val = config.get("metadata", "")
    
    try:
        items_to_add = []
        
        # 1. Extração de P&R via IA
        if config.get("extractQA"):
            # Gera entre 5 e 15 perguntas dependendo do tamanho do texto
            num_q = max(3, min(15, len(text) // 500))
            qa_list, _ = await generate_global_qa(text, total_questions=num_q)
            for item in qa_list:
                items_to_add.append(KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question=item.get("pergunta", "Questão extraída"),
                    answer=item.get("resposta", ""),
                    metadata_val=f"{metadata_val} | Source: Transcrição AI" if metadata_val else "Transcrição AI",
                    category="Transcrição"
                ))
        
        # 3. Geração de Resumo IA
        if config.get("generateSummary"):
            try:
                from agent import get_openai_client
                client = get_openai_client()
                if client:
                    response = await client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "Você é um assistente especialista em síntese de informações. Resuma o texto fornecido em pontos principais (bullet points) de forma executiva e clara. Use Português do Brasil."},
                            {"role": "user", "content": f"Texto para resumir:\n\n{text}"}
                        ],
                        temperature=0.5
                    )
                    summary_text = response.choices[0].message.content
                    items_to_add.append(KnowledgeItemModel(
                        knowledge_base_id=kb_id,
                        question=f"Resumo da Transcrição - {metadata_val}" if metadata_val else "Resumo da Transcrição",
                        answer=summary_text,
                        metadata_val=f"{metadata_val} | Source: Resumo de Transcrição IA" if metadata_val else "Resumo de Transcrição IA",
                        category="Resumo"
                    ))
            except Exception as se:
                logger.error(f"Erro ao gerar resumo no RAG: {se}")
        
        # 2. Extração de Chunks (Conhecimento Puro)
        if config.get("extractChunks"):
            c_size = config.get("chunkSize", 1200)
            c_overlap = config.get("chunkOverlap", 150)
            chunks = chunk_text(text, chunk_size=c_size, overlap=c_overlap)
            for i, chunk in enumerate(chunks):
                items_to_add.append(KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question=f"Trecho de Conhecimento {i+1} - {metadata_val}" if metadata_val else f"Trecho de Conhecimento {i+1}",
                    answer=chunk["text"],
                    metadata_val=metadata_val or "Chunk Transcrição",
                    category="Chunking"
                ))

        if not items_to_add:
            # Fallback se nada foi selecionado
            items_to_add.append(KnowledgeItemModel(
                knowledge_base_id=kb_id,
                question="Conteúdo da Transcrição",
                answer=text,
                metadata_val=metadata_val or "Transcrição Direta",
                category="Transcrição"
            ))

        # 3. Geração de Embeddings e Salvamento em Lote
        batch_size = 100
        for i in range(0, len(items_to_add), batch_size):
            batch = items_to_add[i:i+batch_size]
            texts = [f"{item.metadata_val} | {item.question} | {item.answer}" for item in batch]
            embeddings, _ = await get_batch_embeddings(texts)
            for j, item in enumerate(batch):
                if embeddings and j < len(embeddings):
                    item.embedding = embeddings[j]
                db.add(item)
            
        await db.commit()
        return {"message": f"Sucesso! {len(items_to_add)} itens adicionados à base de conhecimento com embeddings gerados."}
        
    except Exception as e:
        logger.error(f"Erro ao processar RAG de transcrição: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro no processamento: {str(e)}")

@app.post("/knowledge-bases/{kb_id}/video-background", dependencies=[Depends(verify_api_key)])
async def process_media_background_endpoint(
    kb_id: int,
    file: UploadFile = File(...),
    config: str = Form("{}"),
    is_media: str = Form("true"),
    db: AsyncSession = Depends(get_db)
):
    """
    Inicia o processamento de arquivo de mídia ou texto em background para uma base de conhecimento.
    """
    import tempfile
    import os
    import json
    from models import BackgroundProcessLog
    
    try:
        config_dict = json.loads(config)
        is_media_bool = is_media.lower() == "true"
        
        suffix = os.path.splitext(file.filename)[1]
        # Define o diretório para temporários como dentro de /app para ser compartilhado via volume entre containers
        os.makedirs("/app/temp_files", exist_ok=True)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir="/app/temp_files") as tmp:
            content = await file.read()
            tmp.write(content)
            file_path = tmp.name
            
        log = BackgroundProcessLog(
            process_name=f"Processamento de Arquivo ({file.filename})",
            status="PENDENTE",
            details={"kb_id": kb_id, "file_path": file_path, "is_media": is_media_bool}
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        
        payload = {
            "file_path": file_path,
            "is_media": is_media_bool,
            "options": config_dict,
            "metadata_val": config_dict.get("metadata", "")
        }
        
        from tasks import process_kb_media_task
        task = process_kb_media_task.delay(log.id, kb_id, payload)
        
        log.task_id = task.id
        await db.commit()
        
        return {
            "message": "Processamento iniciado com sucesso em background.",
            "log_id": log.id
        }
        
    except Exception as e:
        logger.error(f"Erro ao iniciar background de mídia: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/knowledge-bases/analyze-file", dependencies=[Depends(verify_api_key)])
async def analyze_kb_file(file: UploadFile = File(...)):
    import pandas as pd
    import io
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                return {"page_count": len(pdf.pages), "is_pdf": True, "is_image": False}
        elif filename.endswith((".png", ".jpg", ".jpeg", ".webp")):
            return {"page_count": 1, "is_pdf": False, "is_image": True}
        else:
            return {"error": f"Formato '{filename.split('.')[-1]}' não suportado para análise. Use CSV, Excel, PDF ou Imagem."}
            
        return {
            "columns": df.columns.tolist(), 
            "preview": df.head(5).to_dict(orient="records"), 
            "total_rows": len(df),
            "is_pdf": False, 
            "is_image": False
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge-bases/analyze-text", dependencies=[Depends(verify_api_key)])
async def analyze_kb_text(text: str = Form(...)):
    import pandas as pd
    import io
    
    best_df = None
    max_cols = 0
    
    import json
    
    # Try JSON first
    stripped_text = text.strip()
    if (stripped_text.startswith('[') and stripped_text.endswith(']')) or (stripped_text.startswith('{') and stripped_text.endswith('}')):
        try:
            data = json.loads(stripped_text)
            if isinstance(data, dict): data = [data]
            
            # Special case: Knowledge format [ { "context": [...] } ]
            if len(data) > 0 and isinstance(data[0], dict) and "context" in data[0] and isinstance(data[0]["context"], list):
                flattened = []
                for entry in data:
                    parent_meta = entry.get("metadata", "")
                    items = entry.get("context", [])
                    for item in items:
                        if isinstance(item, dict):
                            row = item.copy()
                            if "metadata" not in row and "metadata_val" not in row:
                                row["metadata"] = parent_meta
                            flattened.append(row)
                if flattened:
                    best_df = pd.DataFrame(flattened)
                    max_cols = len(best_df.columns)
            
            if best_df is None:
                df = pd.DataFrame(data)
                if len(df.columns) > 1:
                    best_df = df
                    max_cols = len(df.columns)
        except:
            pass

    # Try HTML next
    if max_cols <= 1 and ("<tr>" in text.lower() or "<table" in text.lower()):
        try:
            dfs = pd.read_html(io.StringIO(text))
            if dfs:
                best_df = dfs[0]
                max_cols = len(best_df.columns)
        except:
            pass
            
    # Try CSV separators if no HTML table was found or has few columns
    if max_cols <= 1:
        separators = ['\t', ';', ',']
        for sep in separators:
            try:
                # Use a small number of lines for analysis
                df = pd.read_csv(io.StringIO(text), sep=sep, nrows=5)
                if len(df.columns) > max_cols:
                    max_cols = len(df.columns)
                    best_df = df
            except:
                continue
            
    if best_df is None or max_cols <= 1:
        return {"error": "Não foi possível detectar colunas no texto. Certifique-se de que é uma tabela ou CSV válido."}
        
    return {
        "columns": [str(c) for c in best_df.columns.tolist()],
        "preview": best_df.head(5).to_dict(orient="records"),
        "total_rows": len(best_df),
        "is_pdf": False,
        "is_image": False,
        "is_structured": True
    }

@app.post("/knowledge-bases/{kb_id}/import-mapped", dependencies=[Depends(verify_api_key)])
async def import_mapped_file(
    kb_id: int, 
    question_col: str = Form(...),
    answer_col: str = Form(...),
    category_col: str | None = Form(None),
    fixed_category: str | None = Form(None),
    metadata_col: str | None = Form(None),
    fixed_metadata: str | None = Form(None),
    answer_mapping_json: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    import pandas as pd
    import io
    import json
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        answer_mappings = []
        if answer_mapping_json:
            answer_mappings = json.loads(answer_mapping_json)

        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            return {"error": "Formato não suportado."}

        # Fetch existing questions to avoid duplicates (Upsert logic)
        existing_result = await db.execute(
            select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb_id)
        )
        # Map stripped lowercase question to the actual item
        existing_map = {item.question.strip().lower(): item for item in existing_result.scalars().all()}

        count = 0
        updated_count = 0
        # Prepare all items to process
        to_process = []
        for _, row in df.iterrows():
            q = str(row.get(question_col, "")).strip()
            
            # Answer construction
            if answer_mappings:
                a_parts = []
                for m in answer_mappings:
                    label = m.get("label", "")
                    col = m.get("column")
                    if col and col in row:
                        val = str(row[col]).strip()
                        if val != "nan":
                            a_parts.append(f"{label}{val}")
                a = "\n".join(a_parts)
            else:
                a = str(row.get(answer_col, "")).strip()
                
            if not q or not a or q == "nan" or a == "nan": continue
            
            cat = "Geral"
            if fixed_category:
                cat = fixed_category
            elif category_col and category_col in row:
                cat = str(row.get(category_col, "Geral")).strip()
            if cat == "nan": cat = "Geral"

            meta_val = ""
            if fixed_metadata:
                meta_val = fixed_metadata
            elif metadata_col and metadata_col in row:
                meta_val = str(row.get(metadata_col, "")).strip()
            if meta_val == "nan": meta_val = ""

            to_process.append({
                "q": q,
                "a": a,
                "cat": cat,
                "meta_val": meta_val,
                "text_for_emb": f"{q} {a}"
            })

        # Process in batches of 100
        batch_size = 100
        for i in range(0, len(to_process), batch_size):
            batch = to_process[i:i+batch_size]
            embeddings, _ = await get_batch_embeddings([it["text_for_emb"] for it in batch])
            
            for j, item in enumerate(batch):
                emb = embeddings[j] if embeddings and j < len(embeddings) else None
                q_key = item["q"].lower()
                
                if q_key in existing_map:
                    db_item = existing_map[q_key]
                    db_item.answer = item["a"]
                    db_item.category = item["cat"]
                    db_item.metadata_val = item["meta_val"]
                    db_item.embedding = emb
                    updated_count += 1
                else:
                    db_item = KnowledgeItemModel(
                        knowledge_base_id=kb_id,
                        question=item["q"],
                        answer=item["a"],
                        metadata_val=item["meta_val"],
                        category=item["cat"],
                        embedding=emb
                    )
                    db.add(db_item)
                    existing_map[q_key] = db_item
                    count += 1
            
        await db.commit()
        msg = f"Importação concluída: {count} novos itens"
        if updated_count > 0:
            msg += f" e {updated_count} atualizados"
        return {"message": msg + "."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge-bases/{kb_id}/import-mapped-text", dependencies=[Depends(verify_api_key)])
async def import_mapped_text(
    kb_id: int, 
    question_col: str = Form(...),
    answer_col: str = Form(...),
    category_col: str | None = Form(None),
    fixed_category: str | None = Form(None),
    metadata_col: str | None = Form(None),
    fixed_metadata: str | None = Form(None),
    answer_mapping_json: str | None = Form(None),
    text: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    import pandas as pd
    import io
    import json
    
    try:
        best_df = None
        stripped_text = text.strip()
        
        # Try JSON first
        if (stripped_text.startswith('[') and stripped_text.endswith(']')) or (stripped_text.startswith('{') and stripped_text.endswith('}')):
            try:
                data = json.loads(stripped_text)
                if isinstance(data, dict): data = [data]
                
                # Check for special Knowledge format
                if len(data) > 0 and isinstance(data[0], dict) and "context" in data[0] and isinstance(data[0]["context"], list):
                    flattened = []
                    for entry in data:
                        parent_meta = entry.get("metadata", "")
                        items = entry.get("context", [])
                        for item in items:
                            if isinstance(item, dict):
                                row = item.copy()
                                if "metadata" not in row and "metadata_val" not in row:
                                    row["metadata"] = parent_meta
                                flattened.append(row)
                    if flattened:
                        best_df = pd.DataFrame(flattened)
                
                if best_df is None:
                    df = pd.DataFrame(data)
                    if len(df.columns) > 1:
                        best_df = df
            except:
                pass

        # Try HTML next
        if best_df is None and ("<tr>" in text.lower() or "<table" in text.lower()):
            try:
                dfs = pd.read_html(io.StringIO(text))
                if dfs: best_df = dfs[0]
            except: pass
            
        # Try CSV separators
        if best_df is None:
            for sep in ['\t', ';', ',']:
                try:
                    df = pd.read_csv(io.StringIO(text), sep=sep)
                    if len(df.columns) > 1:
                        best_df = df
                        break
                except: continue
        
        if best_df is None:
            return {"error": "Não foi possível processar o texto como tabela."}
            
        df = best_df

        # Fetch existing products/questions
        existing_result = await db.execute(
            select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb_id)
        )
        existing_map = {item.question.strip().lower(): item for item in existing_result.scalars().all()}

        answer_mappings = []
        if answer_mapping_json:
            answer_mappings = json.loads(answer_mapping_json)

        count = 0
        updated_count = 0
        for _, row in df.iterrows():
            q = str(row.get(question_col, "")).strip()
            if not q or q == "nan": continue
            
            # Answer construction
            if answer_mappings:
                a_parts = []
                for m in answer_mappings:
                    label = m.get("label", "")
                    col = m.get("column")
                    if col and col in row:
                        val = str(row[col]).strip()
                        if val != "nan":
                            a_parts.append(f"{label}{val}")
                a = "\n".join(a_parts)
            else:
                a = str(row.get(answer_col, "")).strip()
            
            if not a or a == "nan": continue
            
            cat = "Geral"
            if fixed_category:
                cat = fixed_category
            elif category_col and category_col in row:
                cat = str(row.get(category_col, "Geral")).strip()
            if cat == "nan": cat = "Geral"

            meta_val = ""
            if fixed_metadata:
                meta_val = fixed_metadata
            elif metadata_col and metadata_col in row:
                meta_val = str(row.get(metadata_col, "")).strip()
            if meta_val == "nan": meta_val = ""

            # Generate embedding for RAG
            emb, _ = await get_embedding(f"{q} {a}")

            q_lower = q.lower()
            if q_lower in existing_map:
                item = existing_map[q_lower]
                item.answer = a
                item.category = cat
                item.metadata_val = meta_val
                item.embedding = emb
                updated_count += 1
            else:
                new_item = KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question=q,
                    answer=a,
                    category=cat,
                    metadata_val=meta_val,
                    embedding=emb
                )
                db.add(new_item)
                count += 1
        
        await db.commit()
        return {"message": f"Sucesso! {count} itens adicionados e {updated_count} atualizados."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge-bases/{kb_id}/import-products", dependencies=[Depends(verify_api_key)])
async def import_products_file(
    kb_id: int, 
    mapping_json: str = Form(...), # List of {column: str, label: str}
    primary_col: str | None = Form(None),  # Column to use as 'question' / primary key
    category_col: str | None = Form(None),
    fixed_category: str | None = Form(None),
    metadata_col: str | None = Form(None),
    fixed_metadata: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    import pandas as pd
    import io
    import json
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        mappings = json.loads(mapping_json)
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            return {"error": "Formato não suportado."}

        # If primary_col is not provided, use the first column from mapping OR the first column in dataframe
        if not primary_col:
            if mappings and len(mappings) > 0:
                primary_col = mappings[0].get('column')
            
            if not primary_col and len(df.columns) > 0:
                primary_col = df.columns[0]
        
        if not primary_col:
            return {"error": "Nenhuma coluna identificada para importação."}

        # Fetch existing items for this KB
        existing_result = await db.execute(
            select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb_id)
        )
        existing_items_list = existing_result.scalars().all()
        
        # Build existing map: prioritize source_metadata (JSON with primary_key), fallback to question
        existing_map = {}
        for item in existing_items_list:
            pk = None
            if item.source_metadata:
                try:
                    meta = json.loads(item.source_metadata)
                    pk = meta.get("primary_key")
                except: pass
            
            if pk:
                existing_map[pk.lower()] = item
            else:
                existing_map[item.question.strip().lower()] = item

        count = 0
        updated_count = 0
        # Prepare all items to process
        to_process = []
        for _, row in df.iterrows():
            primary_val = str(row.get(primary_col, "")).strip()
            if not primary_val or primary_val == "nan": continue
            
            # Construct formatted content with ": " separator
            content_parts = []
            for m in mappings:
                col = m.get('column')
                label = m.get('label', '')
                val = str(row.get(col, "")).strip()
                if val and val != "nan":
                    # Add colon and space if not present in label
                    label_clean = label.strip()
                    sep = ": " if label_clean and not label_clean.endswith(":") else " "
                    content_parts.append(f"{label}{sep}{val}")
            
            formatted_answer = "\n".join(content_parts)
            fixed_question = "Quais são as informações deste produto:"
            
            cat = "Produtos"
            if fixed_category: cat = fixed_category
            elif category_col and category_col in row:
                cat = str(row.get(category_col, "Produtos")).strip()
            if cat == "nan": cat = "Produtos"

            meta_val = ""
            if fixed_metadata:
                meta_val = fixed_metadata
            elif metadata_col and metadata_col in row:
                meta_val = str(row.get(metadata_col, "")).strip()
            if meta_val == "nan": meta_val = ""

            to_process.append({
                "primary_val": primary_val,
                "question": fixed_question,
                "formatted_answer": formatted_answer,
                "cat": cat,
                "meta_val": meta_val,
                "text_for_emb": f"{primary_val} | {fixed_question} {formatted_answer}"
            })

        # Process in batches of 100
        batch_size = 100
        for i in range(0, len(to_process), batch_size):
            batch = to_process[i:i+batch_size]
            embeddings, _ = await get_batch_embeddings([it["text_for_emb"] for it in batch])
            
            for j, item in enumerate(batch):
                emb = embeddings[j] if embeddings and j < len(embeddings) else None
                q_key = item["primary_val"].lower()
                
                # Store primary_val in source_metadata for future syncs
                source_meta_json = json.dumps({"primary_key": item["primary_val"]})
                
                if q_key in existing_map:
                    db_item = existing_map[q_key]
                    db_item.question = item["question"]
                    db_item.answer = item["formatted_answer"]
                    db_item.category = item["cat"]
                    db_item.metadata_val = item["meta_val"]
                    db_item.embedding = emb
                    db_item.source_metadata = source_meta_json
                    updated_count += 1
                else:
                    db_item = KnowledgeItemModel(
                        knowledge_base_id=kb_id,
                        question=item["question"],
                        answer=item["formatted_answer"],
                        category=item["cat"],
                        metadata_val=item["meta_val"],
                        embedding=emb,
                        source_metadata=source_meta_json
                    )
                    db.add(db_item)
                    existing_map[q_key] = db_item
                    count += 1
            
        await db.commit()
        return {"message": f"Sucesso! {count} produtos adicionados e {updated_count} atualizados."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge-bases/{kb_id}/import-products-text", dependencies=[Depends(verify_api_key)])
async def import_products_text(
    kb_id: int, 
    mapping_json: str = Form(...), 
    primary_col: str | None = Form(None),
    category_col: str | None = Form(None),
    fixed_category: str | None = Form(None),
    metadata_col: str | None = Form(None),
    fixed_metadata: str | None = Form(None),
    text: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    import pandas as pd
    import io
    import json
    
    try:
        mappings = json.loads(mapping_json)
        best_df = None
        stripped_text = text.strip()
        
        # Try JSON first
        if (stripped_text.startswith('[') and stripped_text.endswith(']')) or (stripped_text.startswith('{') and stripped_text.endswith('}')):
            try:
                data = json.loads(stripped_text)
                if isinstance(data, dict): data = [data]
                
                # Check for special Knowledge format
                if len(data) > 0 and isinstance(data[0], dict) and "context" in data[0] and isinstance(data[0]["context"], list):
                    flattened = []
                    for entry in data:
                        parent_meta = entry.get("metadata", "")
                        items = entry.get("context", [])
                        for item in items:
                            if isinstance(item, dict):
                                row = item.copy()
                                if "metadata" not in row and "metadata_val" not in row:
                                    row["metadata"] = parent_meta
                                flattened.append(row)
                    if flattened:
                        best_df = pd.DataFrame(flattened)
                
                if best_df is None:
                    df = pd.DataFrame(data)
                    if len(df.columns) > 1:
                        best_df = df
            except:
                pass

        # Try HTML next
        if best_df is None and ("<tr>" in text.lower() or "<table" in text.lower()):
            try:
                dfs = pd.read_html(io.StringIO(text))
                if dfs: best_df = dfs[0]
            except: pass
            
        # Try CSV separators
        if best_df is None:
            for sep in ['\t', ';', ',']:
                try:
                    df = pd.read_csv(io.StringIO(text), sep=sep)
                    if len(df.columns) > 1:
                        best_df = df
                        break
                except: continue
        
        if best_df is None:
            return {"error": "Não foi possível processar o texto como tabela."}
            
        df = best_df

        # If primary_col is not provided, use the first column from mapping OR the first column in dataframe
        if not primary_col:
            if mappings and len(mappings) > 0:
                primary_col = mappings[0].get('column')
            
            if not primary_col and len(df.columns) > 0:
                primary_col = df.columns[0]
        
        if not primary_col:
            return {"error": "Nenhuma coluna identificada para importação."}

        # Fetch existing items for this KB
        existing_result = await db.execute(
            select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb_id)
        )
        existing_items_list = existing_result.scalars().all()
        
        # Build existing map: prioritize source_metadata (JSON with primary_key), fallback to question
        existing_map = {}
        for item in existing_items_list:
            pk = None
            if item.source_metadata:
                try:
                    meta = json.loads(item.source_metadata)
                    pk = meta.get("primary_key")
                except: pass
            
            if pk:
                existing_map[pk.lower()] = item
            else:
                existing_map[item.question.strip().lower()] = item

        count = 0
        updated_count = 0
        # Prepare all items to process
        to_process = []
        for _, row in df.iterrows():
            primary_val = str(row.get(primary_col, "")).strip()
            if not primary_val or primary_val == "nan": continue
            
            # Construct formatted content with ": " separator
            content_parts = []
            for m in mappings:
                col = m.get('column')
                label = m.get('label', '')
                val = str(row.get(col, "")).strip()
                if val and val != "nan":
                    # Add colon and space if not present in label
                    label_clean = label.strip()
                    sep = ": " if label_clean and not label_clean.endswith(":") else " "
                    content_parts.append(f"{label}{sep}{val}")
            
            formatted_answer = "\n".join(content_parts)
            fixed_question = "Quais são as informações deste produto:"
            
            cat = "Produtos"
            if fixed_category: cat = fixed_category
            elif category_col and category_col in row:
                cat = str(row.get(category_col, "Produtos")).strip()
            if cat == "nan": cat = "Produtos"

            meta_val = ""
            if fixed_metadata:
                meta_val = fixed_metadata
            elif metadata_col and metadata_col in row:
                meta_val = str(row.get(metadata_col, "")).strip()
            if meta_val == "nan": meta_val = ""

            to_process.append({
                "primary_val": primary_val,
                "question": fixed_question,
                "formatted_answer": formatted_answer,
                "cat": cat,
                "meta_val": meta_val,
                "text_for_emb": f"{primary_val} | {fixed_question} {formatted_answer}"
            })

        # Process in batches of 100
        batch_size = 100
        for i in range(0, len(to_process), batch_size):
            batch = to_process[i:i+batch_size]
            embeddings, _ = await get_batch_embeddings([it["text_for_emb"] for it in batch])
            
            for j, item in enumerate(batch):
                emb = embeddings[j] if embeddings and j < len(embeddings) else None
                q_key = item["primary_val"].lower()
                
                # Store primary_val in source_metadata for future syncs
                source_meta_json = json.dumps({"primary_key": item["primary_val"]})
                
                if q_key in existing_map:
                    db_item = existing_map[q_key]
                    db_item.question = item["question"]
                    db_item.answer = item["formatted_answer"]
                    db_item.category = item["cat"]
                    db_item.metadata_val = item["meta_val"]
                    db_item.embedding = emb
                    db_item.source_metadata = source_meta_json
                    updated_count += 1
                else:
                    db_item = KnowledgeItemModel(
                        knowledge_base_id=kb_id,
                        question=item["question"],
                        answer=item["formatted_answer"],
                        category=item["cat"],
                        metadata_val=item["meta_val"],
                        embedding=emb,
                        source_metadata=source_meta_json
                    )
                    db.add(db_item)
                    existing_map[q_key] = db_item
                    count += 1
            
        await db.commit()
        return {"message": f"Sucesso! {count} produtos adicionados e {updated_count} atualizados."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge-bases/{kb_id}/scrape", dependencies=[Depends(verify_api_key)])
async def scrape_kb_url(kb_id: int, url_data: dict, db: AsyncSession = Depends(get_db)):
    url = url_data.get("url")
    if not url: return {"error": "URL required"}
    
    import requests
    from bs4 import BeautifulSoup
    
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for element in soup(["script", "style"]):
            element.decompose()
            
        # Get text
        text = soup.get_text(separator='\n')
        lines = [l.strip() for l in text.split('\n') if len(l.strip()) > 40]
        
        for line in lines[:30]: # Limit to first 30 chunks to avoid bloat
            db_item = KnowledgeItemModel(
                knowledge_base_id=kb_id,
                question=f"Fonte: {url}",
                answer=line,
                category="Web Scraping"
            )
            db.add(db_item)
            
        await db.commit()
        return {"message": f"Scrape realizado com sucesso. {len(lines[:30])} itens criados."}
    except Exception as e:
        return {"error": str(e)}

class CoverageCheckRequest(BaseModel):
    questions: List[str]

@app.post("/knowledge-bases/{kb_id}/coverage", dependencies=[Depends(verify_api_key)])
async def check_coverage(kb_id: int, payload: CoverageCheckRequest, db: AsyncSession = Depends(get_db)):
    results = await calculate_coverage(db, payload.questions, kb_id)
    return {"results": results}

# --- AGENT MANAGEMENT UPDATED ---
@app.get("/agents", response_model=List[AgentConfig], dependencies=[Depends(verify_api_key)])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentConfigModel)
        .options(selectinload(AgentConfigModel.tools))
        .order_by(AgentConfigModel.id)
    )
    db_agents = result.scalars().all()
    return [
        AgentConfig(
            id=a.id,
            name=a.name,
            description=a.description,
            model=a.model,
            fallback_model=a.fallback_model,
            temperature=a.temperature,
            top_p=a.top_p,
            date_awareness=a.date_awareness,
            system_prompt=a.system_prompt,
            context_window=a.context_window,
            knowledge_base=json.loads(a.knowledge_base) if a.knowledge_base else [],
            knowledge_base_id=a.knowledge_base_id,
            tool_ids=[t.id for t in a.tools],
            is_active=a.is_active,
            simulated_time=a.simulated_time,
            security_competitor_blacklist=a.security_competitor_blacklist,
            security_forbidden_topics=a.security_forbidden_topics,
            security_discount_policy=a.security_discount_policy,
            security_language_complexity=a.security_language_complexity,
            security_pii_filter=a.security_pii_filter,
            security_bot_protection=a.security_bot_protection,
            security_max_messages_per_session=a.security_max_messages_per_session,
            security_semantic_threshold=a.security_semantic_threshold,
            security_loop_count=a.security_loop_count,
            security_validator_ia=a.security_validator_ia,
            inbox_capture_enabled=a.inbox_capture_enabled,
            handoff_enabled=a.handoff_enabled,
            response_translation_enabled=a.response_translation_enabled,
            response_translation_fallback_lang=a.response_translation_fallback_lang or "portuguese",
            router_enabled=a.router_enabled,
            router_simple_model=a.router_simple_model,
            router_complex_model=a.router_complex_model,
            top_k=a.top_k,
            presence_penalty=a.presence_penalty,
            frequency_penalty=a.frequency_penalty,
            safety_settings=a.safety_settings,
            model_settings=json.loads(a.model_settings) if a.model_settings else {}
        ) for a in db_agents
    ]

@app.post("/agents", response_model=AgentConfig, dependencies=[Depends(verify_api_key)])
async def create_agent(config: AgentConfig, db: AsyncSession = Depends(get_db)):
    db_config = AgentConfigModel(
        name=config.name,
        description=config.description,
        model=config.model,
        fallback_model=config.fallback_model,
        temperature=config.temperature,
        top_p=config.top_p,
        date_awareness=config.date_awareness,
        system_prompt=config.system_prompt,
        context_window=config.context_window,
        knowledge_base=json.dumps(config.knowledge_base),
        # knowledge_base_id=config.knowledge_base_id, # Legacy, handled via list now
        is_active=config.is_active,
        simulated_time=config.simulated_time,
        rag_retrieval_count=config.rag_retrieval_count,
        rag_translation_enabled=config.rag_translation_enabled,
        rag_multi_query_enabled=config.rag_multi_query_enabled,
        rag_rerank_enabled=config.rag_rerank_enabled,
        rag_agentic_eval_enabled=config.rag_agentic_eval_enabled,
        rag_parent_expansion_enabled=config.rag_parent_expansion_enabled,
        security_competitor_blacklist=config.security_competitor_blacklist,
        security_forbidden_topics=config.security_forbidden_topics,
        security_discount_policy=config.security_discount_policy,
        security_language_complexity=config.security_language_complexity,
        security_pii_filter=config.security_pii_filter,
        security_bot_protection=config.security_bot_protection,
        security_max_messages_per_session=config.security_max_messages_per_session,
        security_semantic_threshold=config.security_semantic_threshold,
        security_loop_count=config.security_loop_count,
        security_validator_ia=config.security_validator_ia,
        ui_primary_color=config.ui_primary_color,
        ui_header_color=config.ui_header_color,
        ui_chat_title=config.ui_chat_title,
        ui_welcome_message=config.ui_welcome_message,
        router_enabled=config.router_enabled,
        router_simple_model=config.router_simple_model,
        router_complex_model=config.router_complex_model,
        inbox_capture_enabled=config.inbox_capture_enabled,
        handoff_enabled=config.handoff_enabled,
        response_translation_enabled=config.response_translation_enabled,
        response_translation_fallback_lang=config.response_translation_fallback_lang or "portuguese",
        top_k=config.top_k,
        presence_penalty=config.presence_penalty,
        frequency_penalty=config.frequency_penalty,
        safety_settings=config.safety_settings,
        model_settings=json.dumps(config.model_settings) if config.model_settings else "{}"
    )
    
    # Handle Tools
    if config.tool_ids:
        result_tools = await db.execute(select(ToolModel).where(ToolModel.id.in_(config.tool_ids)))
        db_config.tools = result_tools.scalars().all()

    # Handle Knowledge Bases (Multi)
    if config.knowledge_base_ids:
        result_kbs = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id.in_(config.knowledge_base_ids)))
        db_config.knowledge_bases = result_kbs.scalars().all()
    elif config.knowledge_base_id: # Legacy fallback
        result_kb = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == config.knowledge_base_id))
        kb = result_kb.scalars().first()
        if kb: db_config.knowledge_bases = [kb]

    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    
    # Reload with relationships
    result = await db.execute(
        select(AgentConfigModel)
        .where(AgentConfigModel.id == db_config.id)
        .options(
            selectinload(AgentConfigModel.tools),
            selectinload(AgentConfigModel.knowledge_bases)
        )
    )
    db_config = result.scalars().first()
    
    return AgentConfig(
        id=db_config.id,
        name=db_config.name,
        description=db_config.description,
        model=db_config.model,
        fallback_model=db_config.fallback_model,
        temperature=db_config.temperature,
        top_p=db_config.top_p,
        date_awareness=db_config.date_awareness,
        system_prompt=db_config.system_prompt,
        context_window=db_config.context_window,
        knowledge_base=json.loads(db_config.knowledge_base) if db_config.knowledge_base else [],
        knowledge_base_id=db_config.knowledge_bases[0].id if db_config.knowledge_bases else None, # Legacy compat
        knowledge_base_ids=[kb.id for kb in db_config.knowledge_bases],
        rag_retrieval_count=db_config.rag_retrieval_count,
        rag_translation_enabled=db_config.rag_translation_enabled,
        rag_multi_query_enabled=db_config.rag_multi_query_enabled,
        rag_rerank_enabled=db_config.rag_rerank_enabled,
        rag_agentic_eval_enabled=db_config.rag_agentic_eval_enabled,
        rag_parent_expansion_enabled=db_config.rag_parent_expansion_enabled,
        tool_ids=[t.id for t in db_config.tools],
        is_active=db_config.is_active,
        simulated_time=db_config.simulated_time,
        security_competitor_blacklist=db_config.security_competitor_blacklist,
        security_forbidden_topics=db_config.security_forbidden_topics,
        security_discount_policy=db_config.security_discount_policy,
        security_language_complexity=db_config.security_language_complexity,
        security_pii_filter=db_config.security_pii_filter,
        security_bot_protection=db_config.security_bot_protection,
        security_max_messages_per_session=db_config.security_max_messages_per_session,
        security_semantic_threshold=db_config.security_semantic_threshold,
        security_loop_count=db_config.security_loop_count,
        security_validator_ia=db_config.security_validator_ia,
        inbox_capture_enabled=db_config.inbox_capture_enabled,
        ui_primary_color=db_config.ui_primary_color,
        ui_header_color=db_config.ui_header_color,
        ui_chat_title=db_config.ui_chat_title,
        ui_welcome_message=db_config.ui_welcome_message,
        router_enabled=db_config.router_enabled,
        router_simple_model=db_config.router_simple_model,
        router_complex_model=db_config.router_complex_model,
        handoff_enabled=db_config.handoff_enabled,
        response_translation_enabled=db_config.response_translation_enabled,
        response_translation_fallback_lang=db_config.response_translation_fallback_lang or "portuguese",
        top_k=db_config.top_k,
        presence_penalty=db_config.presence_penalty,
        frequency_penalty=db_config.frequency_penalty,
        safety_settings=db_config.safety_settings,
        model_settings=json.loads(db_config.model_settings) if db_config.model_settings else {}
    )

@app.get("/agents/models", response_model=List[str], dependencies=[Depends(verify_api_key)])
async def list_available_models():
    return list(MODEL_INFO.keys())

@app.get("/agents/{agent_id}", response_model=AgentConfig, dependencies=[Depends(verify_api_key)])
async def get_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentConfigModel)
        .where(AgentConfigModel.id == agent_id)
        .options(
            selectinload(AgentConfigModel.tools),
            selectinload(AgentConfigModel.knowledge_bases)
        )
    )
    db_config = result.scalars().first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    return AgentConfig(
        id=db_config.id,
        name=db_config.name,
        description=db_config.description,
        model=db_config.model,
        fallback_model=db_config.fallback_model,
        temperature=db_config.temperature,
        top_p=db_config.top_p,
        date_awareness=db_config.date_awareness,
        system_prompt=db_config.system_prompt,
        context_window=db_config.context_window,
        knowledge_base=json.loads(db_config.knowledge_base) if db_config.knowledge_base else [],
        knowledge_base_id=db_config.knowledge_bases[0].id if db_config.knowledge_bases else None,
        knowledge_base_ids=[kb.id for kb in db_config.knowledge_bases],
        rag_retrieval_count=db_config.rag_retrieval_count,
        rag_translation_enabled=db_config.rag_translation_enabled,
        rag_multi_query_enabled=db_config.rag_multi_query_enabled,
        rag_rerank_enabled=db_config.rag_rerank_enabled,
        rag_agentic_eval_enabled=db_config.rag_agentic_eval_enabled,
        rag_parent_expansion_enabled=db_config.rag_parent_expansion_enabled,
        tool_ids=[t.id for t in db_config.tools],
        is_active=db_config.is_active,
        simulated_time=db_config.simulated_time,
        security_competitor_blacklist=db_config.security_competitor_blacklist,
        security_forbidden_topics=db_config.security_forbidden_topics,
        security_discount_policy=db_config.security_discount_policy,
        security_language_complexity=db_config.security_language_complexity,
        security_pii_filter=db_config.security_pii_filter,
        security_bot_protection=db_config.security_bot_protection,
        security_max_messages_per_session=db_config.security_max_messages_per_session,
        security_semantic_threshold=db_config.security_semantic_threshold,
        security_loop_count=db_config.security_loop_count,
        security_validator_ia=db_config.security_validator_ia,
        inbox_capture_enabled=db_config.inbox_capture_enabled,
        ui_primary_color=db_config.ui_primary_color,
        ui_header_color=db_config.ui_header_color,
        ui_chat_title=db_config.ui_chat_title,
        ui_welcome_message=db_config.ui_welcome_message,
        router_enabled=db_config.router_enabled,
        router_simple_model=db_config.router_simple_model,
        router_complex_model=db_config.router_complex_model,
        handoff_enabled=db_config.handoff_enabled,
        response_translation_enabled=db_config.response_translation_enabled,
        response_translation_fallback_lang=db_config.response_translation_fallback_lang or "portuguese",
        top_k=db_config.top_k,
        presence_penalty=db_config.presence_penalty,
        frequency_penalty=db_config.frequency_penalty,
        safety_settings=db_config.safety_settings,
        model_settings=json.loads(db_config.model_settings) if db_config.model_settings else {}
    )

@app.put("/agents/{agent_id}", response_model=AgentConfig, dependencies=[Depends(verify_api_key)])
async def update_agent(agent_id: int, config: AgentConfig, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentConfigModel)
        .where(AgentConfigModel.id == agent_id)
        .options(
            selectinload(AgentConfigModel.tools),
            selectinload(AgentConfigModel.knowledge_bases)
        )
    )
    db_config = result.scalars().first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db_config.name = config.name
    db_config.description = config.description
    db_config.model = config.model
    db_config.fallback_model = config.fallback_model
    db_config.temperature = config.temperature
    db_config.top_p = config.top_p
    db_config.date_awareness = config.date_awareness
    db_config.system_prompt = config.system_prompt
    db_config.context_window = config.context_window
    db_config.knowledge_base = json.dumps(config.knowledge_base)
    # db_config.knowledge_base_id = config.knowledge_base_id # Legacy -> ignore write
    db_config.is_active = config.is_active
    db_config.simulated_time = config.simulated_time
    
    # RAG Settings
    db_config.rag_retrieval_count = config.rag_retrieval_count
    db_config.rag_translation_enabled = config.rag_translation_enabled
    db_config.rag_multi_query_enabled = config.rag_multi_query_enabled
    db_config.rag_rerank_enabled = config.rag_rerank_enabled
    db_config.rag_agentic_eval_enabled = config.rag_agentic_eval_enabled
    db_config.rag_parent_expansion_enabled = config.rag_parent_expansion_enabled
    db_config.inbox_capture_enabled = config.inbox_capture_enabled
    
    # Security Guardrails
    db_config.security_competitor_blacklist = config.security_competitor_blacklist
    db_config.security_forbidden_topics = config.security_forbidden_topics
    db_config.security_discount_policy = config.security_discount_policy
    db_config.security_language_complexity = config.security_language_complexity
    db_config.security_pii_filter = config.security_pii_filter
    db_config.security_bot_protection = config.security_bot_protection
    db_config.security_max_messages_per_session = config.security_max_messages_per_session
    db_config.security_semantic_threshold = config.security_semantic_threshold
    db_config.security_loop_count = config.security_loop_count
    db_config.security_validator_ia = config.security_validator_ia
    
    # UI Customization
    db_config.ui_primary_color = config.ui_primary_color
    db_config.ui_header_color = config.ui_header_color
    db_config.ui_chat_title = config.ui_chat_title
    db_config.ui_welcome_message = config.ui_welcome_message
    
    # Cost Router
    db_config.router_enabled = config.router_enabled
    db_config.router_simple_model = config.router_simple_model
    db_config.router_complex_model = config.router_complex_model
    db_config.handoff_enabled = config.handoff_enabled
    db_config.response_translation_enabled = config.response_translation_enabled
    db_config.response_translation_fallback_lang = config.response_translation_fallback_lang or "portuguese"

    # Advanced Params
    db_config.top_k = config.top_k
    db_config.presence_penalty = config.presence_penalty
    db_config.frequency_penalty = config.frequency_penalty
    db_config.safety_settings = config.safety_settings
    db_config.model_settings = json.dumps(config.model_settings) if config.model_settings else "{}"
    
    # Update tools selection
    if config.tool_ids is not None:
        if config.tool_ids:
            result_tools = await db.execute(select(ToolModel).where(ToolModel.id.in_(config.tool_ids)))
            db_config.tools = result_tools.scalars().all()
        else:
            db_config.tools = []
            
    # Update Knowledge Bases (Multi)
    # If config.knowledge_base_ids is provided (not None), use it. 
    # If it is empty list [], it means clear KBs.
    # If None (not sent?), maybe preserve? But Pydantic defaults to [].
    # So we trust config.knowledge_base_ids.
    
    # Edge case: Frontend might send `knowledge_base_id` (int) but `knowledge_base_ids` (empty).
    # We should merge them if possible, or prefer ids list.
    target_ids = set(config.knowledge_base_ids or [])
    if config.knowledge_base_id:
        target_ids.add(config.knowledge_base_id)
        
    if target_ids:
        kbs = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id.in_(target_ids)))
        db_config.knowledge_bases = kbs.scalars().all()
    else:
        db_config.knowledge_bases = []
    
    await db.commit()
    await db.refresh(db_config)
    
    return AgentConfig(
        id=db_config.id,
        name=db_config.name,
        description=db_config.description,
        model=db_config.model,
        fallback_model=db_config.fallback_model,
        temperature=db_config.temperature,
        top_p=db_config.top_p,
        date_awareness=db_config.date_awareness,
        system_prompt=db_config.system_prompt,
        context_window=db_config.context_window,
        knowledge_base=json.loads(db_config.knowledge_base) if db_config.knowledge_base else [],
        knowledge_base_id=db_config.knowledge_bases[0].id if db_config.knowledge_bases else None,
        knowledge_base_ids=[kb.id for kb in db_config.knowledge_bases],
        rag_retrieval_count=db_config.rag_retrieval_count,
        tool_ids=[t.id for t in db_config.tools],
        is_active=db_config.is_active,
        simulated_time=db_config.simulated_time,
        security_competitor_blacklist=db_config.security_competitor_blacklist,
        security_forbidden_topics=db_config.security_forbidden_topics,
        security_discount_policy=db_config.security_discount_policy,
        security_language_complexity=db_config.security_language_complexity,
        security_pii_filter=db_config.security_pii_filter,
        security_bot_protection=db_config.security_bot_protection,
        security_max_messages_per_session=db_config.security_max_messages_per_session,
        security_semantic_threshold=db_config.security_semantic_threshold,
        security_loop_count=db_config.security_loop_count,
        security_validator_ia=db_config.security_validator_ia,
        inbox_capture_enabled=db_config.inbox_capture_enabled,
        ui_primary_color=db_config.ui_primary_color,
        ui_header_color=db_config.ui_header_color,
        ui_chat_title=db_config.ui_chat_title,
        ui_welcome_message=db_config.ui_welcome_message,
        router_enabled=db_config.router_enabled,
        router_simple_model=db_config.router_simple_model,
        router_complex_model=db_config.router_complex_model,
        handoff_enabled=db_config.handoff_enabled,
        response_translation_enabled=db_config.response_translation_enabled,
        response_translation_fallback_lang=db_config.response_translation_fallback_lang or "portuguese",
        top_k=db_config.top_k,
        presence_penalty=db_config.presence_penalty,
        frequency_penalty=db_config.frequency_penalty,
        safety_settings=db_config.safety_settings,
        model_settings=json.loads(db_config.model_settings) if db_config.model_settings else {}
    )

@app.get("/agents/{agent_id}/drafts", response_model=List[PromptDraft], dependencies=[Depends(verify_api_key)])
async def list_agent_drafts(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptDraftModel).where(PromptDraftModel.agent_id == agent_id).order_by(PromptDraftModel.created_at.desc()))
    return result.scalars().all()

@app.post("/agents/{agent_id}/toggle", response_model=AgentConfig, dependencies=[Depends(verify_api_key)])
async def toggle_agent_status(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == agent_id).options(selectinload(AgentConfigModel.tools)))
    db_config = result.scalars().first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db_config.is_active = not db_config.is_active
    await db.commit()
    await db.refresh(db_config)
    
    return AgentConfig(
        id=db_config.id,
        name=db_config.name,
        description=db_config.description,
        model=db_config.model,
        fallback_model=db_config.fallback_model,
        temperature=db_config.temperature,
        top_p=db_config.top_p,
        is_active=db_config.is_active,
        date_awareness=db_config.date_awareness,
        system_prompt=db_config.system_prompt,
        context_window=db_config.context_window,
        knowledge_base=json.loads(db_config.knowledge_base) if db_config.knowledge_base else [],
        knowledge_base_id=db_config.knowledge_base_id,
        tool_ids=[t.id for t in db_config.tools],
        simulated_time=db_config.simulated_time,
        security_competitor_blacklist=db_config.security_competitor_blacklist,
        security_forbidden_topics=db_config.security_forbidden_topics,
        security_discount_policy=db_config.security_discount_policy,
        security_language_complexity=db_config.security_language_complexity,
        security_pii_filter=db_config.security_pii_filter,
        security_bot_protection=db_config.security_bot_protection,
        security_max_messages_per_session=db_config.security_max_messages_per_session,
        security_semantic_threshold=db_config.security_semantic_threshold,
        security_loop_count=db_config.security_loop_count,
        security_validator_ia=db_config.security_validator_ia,
        ui_primary_color=db_config.ui_primary_color,
        ui_header_color=db_config.ui_header_color,
        ui_chat_title=db_config.ui_chat_title,
        ui_welcome_message=db_config.ui_welcome_message,
        router_enabled=db_config.router_enabled,
        router_simple_model=db_config.router_simple_model,
        router_complex_model=db_config.router_complex_model,
        handoff_enabled=db_config.handoff_enabled,
        response_translation_enabled=db_config.response_translation_enabled,
        response_translation_fallback_lang=db_config.response_translation_fallback_lang or "portuguese",
        top_k=db_config.top_k,
        presence_penalty=db_config.presence_penalty,
        frequency_penalty=db_config.frequency_penalty,
        safety_settings=db_config.safety_settings,
        model_settings=json.loads(db_config.model_settings) if db_config.model_settings else {}
    )

@app.post("/agents/{agent_id}/duplicate", response_model=AgentConfig, dependencies=[Depends(verify_api_key)])
async def duplicate_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == agent_id).options(selectinload(AgentConfigModel.tools)))
    original = result.scalars().first()
    if not original:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    new_agent = AgentConfigModel(
        name=f"{original.name} (Cópia)",
        description=original.description,
        model=original.model,
        fallback_model=original.fallback_model,
        temperature=original.temperature,
        top_p=original.top_p,
        is_active=original.is_active,
        date_awareness=original.date_awareness,
        system_prompt=original.system_prompt,
        context_window=original.context_window,
        knowledge_base=original.knowledge_base,
        knowledge_base_id=original.knowledge_base_id,
        simulated_time=original.simulated_time,
        tools=original.tools[:], # Copy tools list
        router_enabled=original.router_enabled,
        router_simple_model=original.router_simple_model,
        router_complex_model=original.router_complex_model,
        handoff_enabled=original.handoff_enabled,
        response_translation_enabled=original.response_translation_enabled,
        response_translation_fallback_lang=original.response_translation_fallback_lang or "portuguese",
        top_k=original.top_k,
        presence_penalty=original.presence_penalty,
        frequency_penalty=original.frequency_penalty,
        safety_settings=original.safety_settings,
        model_settings=original.model_settings,
        security_competitor_blacklist=original.security_competitor_blacklist,
        security_forbidden_topics=original.security_forbidden_topics,
        security_discount_policy=original.security_discount_policy,
        security_language_complexity=original.security_language_complexity,
        security_pii_filter=original.security_pii_filter,
        security_bot_protection=original.security_bot_protection,
        security_max_messages_per_session=original.security_max_messages_per_session,
        security_semantic_threshold=original.security_semantic_threshold,
        security_loop_count=original.security_loop_count,
        security_validator_ia=original.security_validator_ia,
        ui_primary_color=original.ui_primary_color,
        ui_header_color=original.ui_header_color,
        ui_chat_title=original.ui_chat_title,
        ui_welcome_message=original.ui_welcome_message,
    )
    
    db.add(new_agent)
    await db.commit()
    await db.refresh(new_agent)
    
    # Reload to ensure tools are populated
    result_new = await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == new_agent.id).options(selectinload(AgentConfigModel.tools)))
    new_agent = result_new.scalars().first()

    return AgentConfig(
        id=new_agent.id,
        name=new_agent.name,
        description=new_agent.description,
        model=new_agent.model,
        fallback_model=new_agent.fallback_model,
        temperature=new_agent.temperature,
        top_p=new_agent.top_p,
        is_active=new_agent.is_active,
        date_awareness=new_agent.date_awareness,
        system_prompt=new_agent.system_prompt,
        context_window=new_agent.context_window,
        knowledge_base=json.loads(new_agent.knowledge_base) if new_agent.knowledge_base else [],
        knowledge_base_id=new_agent.knowledge_base_id,
        tool_ids=[t.id for t in new_agent.tools],
        simulated_time=new_agent.simulated_time,
        security_competitor_blacklist=new_agent.security_competitor_blacklist,
        security_forbidden_topics=new_agent.security_forbidden_topics,
        security_discount_policy=new_agent.security_discount_policy,
        security_language_complexity=new_agent.security_language_complexity,
        security_pii_filter=new_agent.security_pii_filter,
        security_bot_protection=new_agent.security_bot_protection,
        security_max_messages_per_session=new_agent.security_max_messages_per_session,
        security_semantic_threshold=new_agent.security_semantic_threshold,
        security_loop_count=new_agent.security_loop_count,
        ui_primary_color=new_agent.ui_primary_color,
        ui_header_color=new_agent.ui_header_color,
        ui_chat_title=new_agent.ui_chat_title,
        ui_welcome_message=new_agent.ui_welcome_message,
        router_enabled=new_agent.router_enabled,
        router_simple_model=new_agent.router_simple_model,
        router_complex_model=new_agent.router_complex_model,
        handoff_enabled=new_agent.handoff_enabled,
        response_translation_enabled=new_agent.response_translation_enabled,
        response_translation_fallback_lang=new_agent.response_translation_fallback_lang or "portuguese",
        top_k=new_agent.top_k,
        presence_penalty=new_agent.presence_penalty,
        frequency_penalty=new_agent.frequency_penalty,
        safety_settings=new_agent.safety_settings,
        model_settings=json.loads(new_agent.model_settings) if new_agent.model_settings else {}
    )

@app.post("/agents/{agent_id}/drafts", response_model=PromptDraft, dependencies=[Depends(verify_api_key)])
async def create_agent_draft(agent_id: int, draft: PromptDraft, db: AsyncSession = Depends(get_db)):
    db_draft = PromptDraftModel(
        agent_id=agent_id,
        prompt_text=draft.prompt_text,
        version_name=draft.version_name,
        character_count=len(draft.prompt_text),
        token_count=len(draft.prompt_text) // 4  # Aprox
    )
    db.add(db_draft)
    await db.commit()
    await db.refresh(db_draft)
    return db_draft

@app.delete("/drafts/{draft_id}", dependencies=[Depends(verify_api_key)])
async def delete_draft(draft_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptDraftModel).where(PromptDraftModel.id == draft_id))
    draft = result.scalars().first()
    if draft:
        await db.delete(draft)
        await db.commit()
    return {"message": "Draft deleted"}
    
@app.put("/drafts/{draft_id}", response_model=PromptDraft, dependencies=[Depends(verify_api_key)])
async def update_draft(draft_id: int, draft: PromptDraft, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptDraftModel).where(PromptDraftModel.id == draft_id))
    db_draft = result.scalars().first()
    if not db_draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    db_draft.version_name = draft.version_name
    db_draft.prompt_text = draft.prompt_text
    db_draft.character_count = len(draft.prompt_text)
    db_draft.token_count = len(draft.prompt_text) // 4
    
    await db.commit()
    await db.refresh(db_draft)
    return db_draft

@app.delete("/agents/{agent_id}", dependencies=[Depends(verify_api_key)])
async def delete_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == agent_id))
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    await db.delete(agent)
    await db.commit()
    return {"message": "Agent deleted"}

@app.get("/tools", response_model=List[ToolResponse], dependencies=[Depends(verify_api_key)])
async def list_tools(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolModel).order_by(ToolModel.id))
    return result.scalars().all()

@app.post("/integrations/google/provision-tools", dependencies=[Depends(verify_api_key)])
async def provision_google_calendar_tools(db: AsyncSession = Depends(get_db)):
    """Cria as ferramentas nativas do Google Calendar no catálogo de ferramentas."""
    GCAL_TOOLS = [
        {
            "name": "google_calendar_criar_evento",
            "description": "Cria um novo evento no Google Calendar do usuário. Use quando o usuário pedir para agendar, marcar ou criar um compromisso, reunião ou tarefa. Suporta cor personalizada, convidados por e-mail e recorrência (semanal, mensal, etc).",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "titulo": {"type": "string", "description": "Título do evento"},
                    "inicio": {"type": "string", "description": "Data/hora de início no formato ISO 8601 (ex: 2024-10-25T09:00:00-03:00)"},
                    "fim": {"type": "string", "description": "Data/hora de fim no formato ISO 8601 (ex: 2024-10-25T10:00:00-03:00)"},
                    "descricao": {"type": "string", "description": "Descrição ou notas adicionais do evento (opcional)"},
                    "local": {"type": "string", "description": "Localização ou endereço do evento (opcional)"},
                    "cor": {"type": "string", "description": "Cor do evento no Google Calendar. Use o nome em português ou inglês: vermelho/red, rosa/pink, laranja/orange, amarelo/yellow, verde/green, azul/blue, roxo/purple, cinza/gray, lavanda/lavender (opcional)"},
                    "convidados": {"type": "string", "description": "E-mails dos convidados separados por vírgula (ex: 'joao@email.com, maria@email.com') (opcional)"},
                    "recorrencia": {"type": "string", "description": "Regra de recorrência no formato RRULE. Exemplos: 'FREQ=WEEKLY;COUNT=10' (semanal por 10x), 'FREQ=DAILY;UNTIL=20241231T235959Z' (diário até data), 'FREQ=MONTHLY;BYDAY=1MO' (toda primeira segunda). Deixe em branco para evento único (opcional)"}
                },
                "required": ["titulo", "inicio", "fim"]
            })
        },
        {
            "name": "google_calendar_listar_eventos",
            "description": "Lista eventos do Google Calendar num período específico. Use para consultar compromissos futuros OU passados. Se o usuário perguntar sobre eventos de ontem, semana passada, mês passado, etc., use os parâmetros 'inicio' e 'fim' para definir o intervalo correto.",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "max_resultados": {"type": "integer", "description": "Quantidade máxima de eventos para retornar (padrão: 5, máximo recomendado: 10)"},
                    "inicio": {"type": "string", "description": "Data/hora de início do período a listar no formato ISO 8601 (ex: 2024-10-20T00:00:00-03:00). Deixe vazio para listar a partir de agora."},
                    "fim": {"type": "string", "description": "Data/hora de fim do período a listar no formato ISO 8601 (ex: 2024-10-27T23:59:59-03:00). Fundamental para buscar eventos passados ÔÇö defina como o fim do período desejado."}
                },
                "required": []
            })
        },
        {
            "name": "google_calendar_atualizar_evento",
            "description": "Atualiza um evento existente no Google Calendar. Use quando o usuário quiser editar, alterar, reagendar um compromisso, adicionar/remover convidados ou mudar a cor. ├ë necessário ter o ID do evento (obtido ao criar ou listar eventos).",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "evento_id": {"type": "string", "description": "ID único do evento (obtido ao criar ou listar eventos)"},
                    "titulo": {"type": "string", "description": "Novo título do evento (opcional)"},
                    "inicio": {"type": "string", "description": "Nova data/hora de início no formato ISO 8601 (opcional)"},
                    "fim": {"type": "string", "description": "Nova data/hora de fim no formato ISO 8601 (opcional)"},
                    "descricao": {"type": "string", "description": "Nova descrição do evento (opcional)"},
                    "local": {"type": "string", "description": "Novo local do evento (opcional)"},
                    "cor": {"type": "string", "description": "Nova cor do evento no Google Calendar. Use o nome em português ou inglês: vermelho/red, rosa/pink, laranja/orange, amarelo/yellow, verde/green, azul/blue, roxo/purple, cinza/gray, lavanda/lavender (opcional)"},
                    "convidados": {"type": "string", "description": "Lista completa de e-mails separados por vírgula. Substitui todos os convidados atuais (opcional)"},
                    "recorrencia": {"type": "string", "description": "Nova regra de recorrência RRULE (opcional)"}
                },
                "required": ["evento_id"]
            })
        },
        {
            "name": "google_calendar_deletar_evento",
            "description": "Remove um evento do Google Calendar. Use quando o usuário pedir para cancelar ou excluir um compromisso. ├ë necessário ter o ID do evento.",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "evento_id": {"type": "string", "description": "ID único do evento a ser removido (obtido ao criar ou listar eventos)"}
                },
                "required": ["evento_id"]
            })
        },
        {
            "name": "google_calendar_buscar_eventos",
            "description": "Busca eventos por texto no Google Calendar. Use quando o usuário quiser encontrar um evento específico pelo nome, descrição ou local, antes de atualizá-lo ou deletá-lo.",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "busca": {"type": "string", "description": "Termo de busca (nome do evento, palavra-chave, local, etc.)"},
                    "max_resultados": {"type": "integer", "description": "Quantidade máxima de resultados (padrão: 5)"}
                },
                "required": ["busca"]
            })
        },
        {
            "name": "google_calendar_verificar_disponibilidade",
            "description": "Verifica se um horário específico está livre ou ocupado na agenda. Use ANTES de criar um evento quando o usuário quiser confirmar disponibilidade, evitar conflitos ou quando disser 'verifique se estou livre'.",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "inicio": {"type": "string", "description": "Data/hora de início do período a verificar no formato ISO 8601 (ex: 2024-10-25T09:00:00-03:00)"},
                    "fim": {"type": "string", "description": "Data/hora de fim do período a verificar no formato ISO 8601 (ex: 2024-10-25T10:00:00-03:00)"}
                },
                "required": ["inicio", "fim"]
            })
        },
        {
            "name": "registrar_duvida_sem_resposta",
            "description": "AVISO INTERNO DA IA: Chame esta ferramenta SEMPRE que o usuário fizer uma pergunta e você N├âO SOUBER a resposta ou não encontrar a informação na sua base de conhecimento (RAG). Isso envia a dúvida para o Inbox Humano.",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "pergunta": {"type": "string", "description": "A pergunta exata do usuário que você não soube responder."}
                },
                "required": ["pergunta"]
            })
        }
    ]
    
    created = []
    updated = []
    for tool_data in GCAL_TOOLS:
        existing_result = await db.execute(select(ToolModel).where(ToolModel.name == tool_data["name"]))
        existing = existing_result.scalars().first()
        if not existing:
            new_tool = ToolModel(**tool_data)
            db.add(new_tool)
            created.append(tool_data["name"])
        else:
            # Atualiza descrição e schema caso já exista
            existing.description = tool_data["description"]
            existing.parameters_schema = tool_data["parameters_schema"]
            updated.append(tool_data["name"])
    
    await db.commit()
    msg = []
    if created: msg.append(f"Criadas: {created}")
    if updated: msg.append(f"Atualizadas: {updated}")
    return {"message": " | ".join(msg) if msg else "Nenhuma alteração.", "created": created, "updated": updated}


@app.post("/tools", response_model=ToolResponse, dependencies=[Depends(verify_api_key)])
async def create_tool(tool: ToolCreate, db: AsyncSession = Depends(get_db)):
    db_tool = ToolModel(
        name=tool.name,
        description=tool.description,
        parameters_schema=tool.parameters_schema,
        webhook_url=tool.webhook_url
    )
    db.add(db_tool)
    await db.commit()
    await db.refresh(db_tool)
    return db_tool

@app.delete("/tools/{tool_id}", dependencies=[Depends(verify_api_key)])
async def delete_tool(tool_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolModel).where(ToolModel.id == tool_id))
    tool = result.scalars().first()
    if tool:
        await db.delete(tool)
        await db.commit()
    return {"status": "deleted"}

@app.put("/tools/{tool_id}", response_model=ToolResponse, dependencies=[Depends(verify_api_key)])
async def update_tool(tool_id: int, tool: ToolCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolModel).where(ToolModel.id == tool_id))
    db_tool = result.scalars().first()
    
    if not db_tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Update fields
    db_tool.name = tool.name
    db_tool.description = tool.description
    db_tool.parameters_schema = tool.parameters_schema
    db_tool.webhook_url = tool.webhook_url
    
    await db.commit()
    await db.refresh(db_tool)
    return db_tool

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    # Remove o ID entre parênteses se existir (ex: "gpt-5.2 (gpt-5.2-2026-01-20)" -> "gpt-5.2")
    clean_model = model.split(" (")[0] if " (" in model else model
    
    info = MODEL_INFO.get(clean_model, MODEL_INFO.get("gpt-4o-mini", next(iter(MODEL_INFO.values())))) 
    cost = (input_tokens * info["input"]) + (output_tokens * info["output"])
    return cost

from sqlalchemy import delete
from typing import List

class DeleteSessionsRequest(BaseModel):
    session_ids: List[str]

@app.post("/sessions/delete", dependencies=[Depends(verify_api_key)])
async def delete_sessions(request: DeleteSessionsRequest, db: AsyncSession = Depends(get_db)):
    # Deletar logs e resumos associados
    if not request.session_ids:
        return {"message": "Nenhuma sessão selecionada"}
        
    await db.execute(delete(SessionSummary).where(SessionSummary.session_id.in_(request.session_ids)))
    await db.execute(delete(InteractionLog).where(InteractionLog.session_id.in_(request.session_ids)))
    await db.commit()
    return {"message": f"{len(request.session_ids)} sess├Áes deletadas com sucesso"}


# ... (imports)

async def get_chat_history(db: AsyncSession, limit: int, session_id: str | None = None):
    if limit <= 0:
        return []
    
    # Busca as últimas 'limit' interaç├Áes ordenadas pela mais recente
    query = select(InteractionLog)
    if session_id:
        query = query.where(InteractionLog.session_id == session_id)
    
    stmt = query.order_by(InteractionLog.timestamp.desc()).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    
    history = []
    # Inverte para ordem cronológica (Antigo -> Novo) para o contexto fazer sentido
    for row in reversed(rows):
        history.append({"role": "user", "content": row.user_message})
        history.append({"role": "assistant", "content": row.agent_response})

    # Verificar se o último item foi um handoff e injetar um System Message de Contexto
    if rows and rows[0].handoff_to:
        # Extrair resumo do debug_info se disponível
        summary = "Não disponível"
        try:
            debug = json.loads(rows[0].debug_info) if rows[0].debug_info else {}
            summary = debug.get("summary", "Não disponível")
        except: pass

        history.append({
            "role": "system", 
            "content": f"🚨 ATEN├ç├âO: Você está assumindo este atendimento agora através de uma TRANSFER├èNCIA.\n"
                       f"### RESUMO DO ATENDIMENTO ANTERIOR:\n{summary}\n\n"
                       f"Instrução: Retome o atendimento de forma fluida, demonstrando que você já sabe o que foi tratado."
        })
        
    return history

@app.post("/execute", response_model=MessageResponse)
async def execute_agent(
    request: MessageRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_api_key)
):
    logger.info(f"--- DEBUG EXECUTE START ---")
    logger.info(f"Request: agent_id={request.agent_id}, session_id={request.session_id}")
    # Load config from DB with tools
    result = await db.execute(
        select(AgentConfigModel)
        .where(AgentConfigModel.id == request.agent_id)
        .options(
            selectinload(AgentConfigModel.tools),
            selectinload(AgentConfigModel.knowledge_bases)
        )
    )
    db_config = result.scalars().first()
    if not db_config:
        logger.error(f"ERROR: Agent {request.agent_id} not found in DB")
        raise HTTPException(status_code=404, detail="Agent not found")
    logger.info(f"Agent found: {db_config.name}")

    # Convert SQLAlchemy model to Pydantic for agent consumption
    agent_config = AgentConfig(
        id=db_config.id,
        name=db_config.name,
        description=db_config.description,
        model=db_config.model,
        fallback_model=db_config.fallback_model,
        temperature=db_config.temperature,
        top_p=db_config.top_p,
        date_awareness=db_config.date_awareness,
        system_prompt=db_config.system_prompt,
        context_window=db_config.context_window,
        knowledge_base=json.loads(db_config.knowledge_base) if isinstance(db_config.knowledge_base, str) and db_config.knowledge_base else (db_config.knowledge_base if isinstance(db_config.knowledge_base, list) else []),
        knowledge_base_id=db_config.knowledge_base_id,
        knowledge_base_ids=[kb.id for kb in db_config.knowledge_bases],
        rag_retrieval_count=db_config.rag_retrieval_count,
        tool_ids=[t.id for t in db_config.tools],
        is_active=db_config.is_active,
        simulated_time=db_config.simulated_time,
        security_competitor_blacklist=db_config.security_competitor_blacklist,
        security_forbidden_topics=db_config.security_forbidden_topics,
        security_discount_policy=db_config.security_discount_policy,
        security_language_complexity=db_config.security_language_complexity,
        security_pii_filter=db_config.security_pii_filter,
        security_bot_protection=db_config.security_bot_protection,
        security_max_messages_per_session=db_config.security_max_messages_per_session,
        security_semantic_threshold=db_config.security_semantic_threshold,
        security_loop_count=db_config.security_loop_count,
        security_validator_ia=db_config.security_validator_ia,
        ui_primary_color=db_config.ui_primary_color,
        ui_header_color=db_config.ui_header_color,
        ui_chat_title=db_config.ui_chat_title,
        ui_welcome_message=db_config.ui_welcome_message,
        router_enabled=db_config.router_enabled,
        router_simple_model=db_config.router_simple_model,
        router_simple_fallback_model=db_config.router_simple_fallback_model,
        router_complex_model=db_config.router_complex_model,
        router_complex_fallback_model=db_config.router_complex_fallback_model,
        handoff_enabled=db_config.handoff_enabled,
        response_translation_enabled=db_config.response_translation_enabled,
        response_translation_fallback_lang=db_config.response_translation_fallback_lang or "portuguese",
        top_k=db_config.top_k,
        presence_penalty=db_config.presence_penalty,
        frequency_penalty=db_config.frequency_penalty,
        safety_settings=db_config.safety_settings,
        model_settings=json.loads(db_config.model_settings) if db_config.model_settings else {}
    )

    # Arena Overrides (Precedes config but allows for comparison)
    if request.model_override:
        agent_config.model = request.model_override
        # Disabilita router se estiver forçando um modelo
        agent_config.router_enabled = False 
    if request.system_prompt_override:
        agent_config.system_prompt = request.system_prompt_override

    # Recupera ferramentas selecionadas do banco
    tools = []
    model_info = MODEL_INFO.get(db_config.model)
    if model_info and model_info.get("supports_tools"):
        tools = db_config.tools # Use tools from relationship!
    
    # Busca histórico da sessão (se houver request.session_id)
    session_id = request.session_id
    if not session_id:
        # Se não vier session_id, podemos criar um temporário ou apenas não usar histórico
        # Mas o frontend costuma mandar. Vamos assumir que se vier, usamos.
        history = []
    else:
        # Recupera histórico baseado na janela de contexto configurada
        history = await get_chat_history(db, agent_config.context_window, session_id)
    
    # Prepara variáveis de contexto (Garante session_id para memória)
    ctx = {}

    # 1. Busca variáveis globais do banco
    result_global = await db.execute(select(GlobalContextVariableModel))
    global_vars = result_global.scalars().all()
    for gv in global_vars:
        if gv.value is not None:
            val = gv.value
            # Cast baseado no tipo definido
            if gv.type == "number":
                try:
                    val = float(val) if "." in val else int(val)
                except: pass
            elif gv.type == "boolean":
                val = val.lower() in ("true", "1", "yes", "sim", "v")

            ctx[gv.key] = val

    # 2. Mescla com as variáveis enviadas no request (que têm precedência)
    if request.context_variables:
        ctx.update(request.context_variables)

    if session_id: ctx["session_id"] = session_id

    # Processa a mensagem
    start_perf = time.perf_counter()
    result = await process_message(request.message, history, agent_config, tools, ctx, db=db)
    end_perf = time.perf_counter()
    response_time_ms = int((end_perf - start_perf) * 1000)

    # Garante que context_variables sempre aparece no debug (independente do caminho de retorno)
    _filtered_ctx = {k: v for k, v in ctx.items() if k not in INTERNAL_CTX_KEYS}
    if _filtered_ctx:
        if result.get("debug") is None:
            result["debug"] = {}
        if "context_variables" not in result["debug"]:
            result["debug"]["context_variables"] = _filtered_ctx

    content = result["content"]
    
    # --- MEMORY UPDATE (Extract new facts) ---
    if session_id and content:
        try:
            from agent import update_user_memory
            await update_user_memory(db, session_id, request.message, content)
        except Exception as e:
            print(f"⚠️´©Å Erro ao disparar extrator de memória: {e}")
    usage = result.get("usage")
    tool_calls = result.get("tool_calls")
    model = result.get("model", "unknown")
    
    input_tokens = 0
    output_tokens = 0
    cost_usd = 0.0
    cost_brl = 0.0
    
    # Detailed tracking
    mini_cost = 0.0
    main_cost = 0.0

    if usage:
        input_tokens = usage.prompt_tokens
        output_tokens = usage.completion_tokens
        
        # Calculate mini vs main costs if detailed usage is available
        if hasattr(usage, "mini_prompt"):
            m_model = agent_config.router_simple_model or "gpt-4o-mini"
            mini_cost = calculate_cost(m_model, usage.mini_prompt, usage.mini_completion)
            main_cost = calculate_cost(model, usage.main_prompt, usage.main_completion)
            cost_usd = mini_cost + main_cost
        else:
            cost_usd = calculate_cost(model, input_tokens, output_tokens)
            
        cost_brl = cost_usd * USD_TO_BRL

    # --- RESPONSE TRANSLATION ---
    trans_enabled = getattr(agent_config, 'response_translation_enabled', False)
    print(f"🌐 Translation enabled: {trans_enabled}")
    if content and trans_enabled:
        try:
            from rag_service import detect_message_language, translate_to_language
            # Use router simple model if configured, otherwise fall back to gpt-4o-mini
            trans_model = agent_config.router_simple_model if agent_config.router_simple_model else "gpt-4o-mini"
            fallback_lang = getattr(agent_config, 'response_translation_fallback_lang', 'pt-br') or 'pt-br'
            detected_lang, u_detect = await detect_message_language(request.message, model=trans_model)
            used_fallback = not detected_lang
            target_lang = detected_lang if detected_lang else fallback_lang
            translated, u_trans = await translate_to_language(content, target_lang, model=trans_model)
            if translated:
                content = translated
            # Add translation cost
            trans_cost = 0.0
            for u in [u_detect, u_trans]:
                if u:
                    trans_cost += calculate_cost(trans_model, getattr(u, 'prompt_tokens', 0), getattr(u, 'completion_tokens', 0))
                    input_tokens += getattr(u, 'prompt_tokens', 0)
                    output_tokens += getattr(u, 'completion_tokens', 0)
            cost_usd += trans_cost
            cost_brl = cost_usd * USD_TO_BRL
            # Add debug info for RaioX
            if result.get("debug") is None:
                result["debug"] = {}
            result["debug"]["translation"] = {
                "detected_lang": detected_lang,
                "target_lang": target_lang,
                "used_fallback": used_fallback,
                "model": trans_model,
            }
        except Exception as e:
            import traceback
            print(f"⚠️ Response translation error: {e}")
            traceback.print_exc()

    # Log to DB if session_id is present (Safely)
    if usage and request.session_id:
        try:
            log_entry = InteractionLog(
                agent_id=db_config.id,
                session_id=request.session_id,
                user_message=request.message,
                agent_response=content if content else "(Tool Call)",
                model_used=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost_usd,
                cost_brl=cost_brl,
                handoff_to=(result.get("handoff_data") or {}).get("destino") if isinstance(result.get("handoff_data"), dict) else None,
                debug_info=json.dumps({
                    **(result.get("debug") or {}),
                    "mini_tokens": {"in": getattr(usage, "mini_prompt", 0), "out": getattr(usage, "mini_completion", 0)},
                    "main_tokens": {"in": getattr(usage, "main_prompt", 0), "out": getattr(usage, "main_completion", 0)},
                    "mini_cost_brl": round(mini_cost * USD_TO_BRL, 6),
                    "main_cost_brl": round(main_cost * USD_TO_BRL, 6)
                }, default=str)
            )
            db.add(log_entry)
            # --- SUPORTE HUMANO VIA FERRAMENTA ---
            # Detecta chamada de ferramenta de suporte e cria ticket
            support_triggered = False
            support_reason = "Solicitação via ferramenta"
            debug_data = result.get("debug") or {}
            performed_calls = debug_data.get("tool_calls") or []
            for call in performed_calls:
                call_name = call.get("name", "").lower()
                call_output = str(call.get("output", "")).lower()
                # Detecta ferramenta de suporte pelo nome (não pelo output)
                is_support_tool = any(x in call_name for x in ["suporte", "atendente", "humano", "transbordo"])
                # Verifica que não retornou erro explicito
                is_error = call_output.startswith("erro") or "error" in call_output[:30]
                if is_support_tool and not is_error:
                    support_triggered = True
                    support_reason = f"Acionado via ferramenta: {call_name}"
                    break

            if support_triggered:
                chk = await db.execute(select(SupportRequestModel).where(
                    SupportRequestModel.session_id == request.session_id,
                    SupportRequestModel.status == "OPEN"
                ))
                if not chk.scalars().first():
                    from agent import generate_handoff_summary, extract_custom_variables
                    ctx = request.context_variables or {}
                    u_name = ctx.get("nome_cliente") or ctx.get("nome") or "Usuário Anônimo"
                    u_email = ctx.get("email_cliente") or ctx.get("email")
                    history = await get_chat_history(db, 20, request.session_id)
                    full_h = history + [{"role": "user", "content": request.message}]
                    if content:
                        full_h.append({"role": "assistant", "content": content})
                    sum_text = await generate_handoff_summary(full_h)
                    extra_vals = await extract_custom_variables(full_h, db, config=db_config)
                    support_req = SupportRequestModel(
                        agent_id=db_config.id,
                        session_id=request.session_id,
                        user_name=u_name,
                        user_email=u_email,
                        summary=sum_text,
                        reason=support_reason,
                        extracted_data=extra_vals
                    )
                    db.add(support_req)
            # --- FIM SUPORTE HUMANO ---
            await db.commit()
        except Exception as log_error:
            logger.error(f"⚠️´©Å Erro ao salvar log de interação: {log_error}")
            await db.rollback()

    if usage:
        # Print info to terminal
        print("\n" + "="*50)
        print("📊 RELAT├ôRIO DE EXECU├ç├âO DETALHADO")
        print("="*50)
        print(f"­ƒñû Modelo Principal: {model}")
        if hasattr(usage, "mini_prompt"):
            print(f"­ƒôë MINI (RAG/Cálculos): {usage.mini_prompt + usage.mini_completion} tokens (R$ {mini_cost * USD_TO_BRL:.4f})")
            print(f"🧠 MAIN (Resposta):     {usage.main_prompt + usage.main_completion} tokens (R$ {main_cost * USD_TO_BRL:.4f})")
        print(f"­ƒôÑ Total Input:  {input_tokens}")
        print(f"­ƒôñ Total Output: {output_tokens}")
        print("-" * 20)
        print(f"💰 Custo Total (USD): ${cost_usd:.6f}")
        print(f"­ƒÆ© Custo Total (BRL): R${cost_brl:.6f}")
        print("="*50 + "\n")

    return {
        "response": content if content else "",
        "content": content if content else "", # Compatibilidade com n8n e fluxos antigos
        "cost_usd": round(cost_usd, 6),
        "cost_brl": round(cost_brl, 6),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "tool_calls": tool_calls,
        "handoff_data": result.get("handoff_data"),
        "debug": result.get("debug"),
        "response_time_ms": response_time_ms,
        "model_used": model,
        "model_role": result.get("model_role", "main"),
        "error": result.get("error", False)
    }

class SessionPreview(BaseModel):
    session_id: str | None = None
    agent_id: int | None = None
    agent_name: str | None = None
    start_time: datetime | None = None
    last_interaction: datetime | None = None
    message_count: int | None = 0
    summary: str | None = None
    total_cost: float | None = 0.0
    is_test_session: bool | None = False

class SessionMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime
    cost: float
    tokens: int
    input_tokens: int | None = 0
    output_tokens: int | None = 0
    model: str | None
    debug: Dict[str, Any] | None = None

class TesterProvocationRequest(BaseModel):
    session_id: str | None = None
    persona_prompt: str
    history: List[Dict[str, str]]
    agent_id: int | None = None
    agent_prompt: str | None = None
    is_dynamic: bool | None = False

class TesterEvaluationRequest(BaseModel):
    session_id: str | None = None
    agent_id: int | None = None
    persona_prompt: str
    history: List[Dict[str, str]]
    agent_prompt: str | None = None

class TesterSentimentRequest(BaseModel):
    history: List[Dict[str, str]]

async def _log_tester_cost(db: AsyncSession, model: str, usage, action: str, session_id: str = "SYS_TESTER"):
    if not usage: return
    try:
        from config_store import MODEL_INFO, USD_TO_BRL
        pricing = MODEL_INFO.get(model, MODEL_INFO.get("gpt-4o-mini", {"input": 0.0, "output": 0.0}))
        inp = getattr(usage, "prompt_tokens", 0)
        out = getattr(usage, "completion_tokens", 0)
        cost = (inp * pricing.get("input", 0.0)) + (out * pricing.get("output", 0.0))
        log = InteractionLog(
            session_id=session_id,
            user_message=f"Teste RAG ({action})",
            agent_response="Avaliação concluída.",
            model_used=model,
            input_tokens=inp,
            output_tokens=out,
            cost_usd=cost,
            cost_brl=cost * USD_TO_BRL
        )
        db.add(log)
        await db.commit()
    except Exception as e:
        logger.error(f"Erro salvando custo do tester: {e}")

@app.post("/tester/provoke")
async def provoke_agent(
    request: TesterProvocationRequest, 
    db: AsyncSession = Depends(get_db), 
    _: None = Depends(verify_api_key)
):
    client = get_openai_client()
    if not client:
        raise HTTPException(status_code=500, detail="OpenAI Client not configured")
    
    dynamic_instruction = ""
    if request.is_dynamic:
        dynamic_instruction = "\nMODO DINÂMICO ATIVO: Se o agente estiver sendo ignorante, lento ou repetitivo, sinta-se à vontade para mudar seu humor para mais irritado ou impaciente. Se ele for excelente, torne-se mais amigável."

    # --- KNOWLEDGE CONTEXT FOR TESTER ---
    kb_summary = ""
    if request.agent_id:
        try:
            from sqlalchemy.orm import selectinload
            # Buscar bases de conhecimento vinculadas ao agente
            stmt = select(AgentConfigModel).where(AgentConfigModel.id == request.agent_id).options(selectinload(AgentConfigModel.knowledge_bases))
            result = await db.execute(stmt)
            agent = result.scalars().first()
            
            if agent and agent.knowledge_bases:
                kb_ids = [kb.id for kb in agent.knowledge_bases]
                # Buscar alguns itens de conhecimento para o tester entender o que o agente sabe
                kb_stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id.in_(kb_ids)).limit(20)
                kb_result = await db.execute(kb_stmt)
                items = kb_result.scalars().all()
                kb_summary = "\n".join([f"- Pergunta: {i.question} | Resposta: {i.answer[:200]}..." for i in items])
        except Exception as e:
            logger.error(f"Erro ao buscar KB para o tester: {e}")

    system_content = f"{request.persona_prompt}{dynamic_instruction}\n" \
                     f"Você é um cliente conversando com um agente de IA. Seu objetivo é testar a qualidade do agente.\n" \
                     f"Gere a sua próxima fala de provocação e também uma nota de sentimento (0 a 100, onde 0 é furioso e 100 é encantado).\n" \
                     f"Retorne em formato JSON: {{\"provocation\": \"fala aqui\", \"sentiment\": 50}}"
    
    if request.agent_prompt:
        system_content += f"\n\n[WHITE BOX] INSTRUÇÕES INTERNAS DO AGENTE:\n'''\n{request.agent_prompt}\n'''"
    
    if kb_summary:
        system_content += f"\n\n[WHITE BOX] BASE DE CONHECIMENTO DO AGENTE (O que ele deve saber):\n'''\n{kb_summary}\n'''"
        system_content += f"\n\nESTRATÉGIA: Baseie-se no conhecimento acima para fazer perguntas que um usuário real faria, mas também tente 'pegar o agente' testando se ele realmente sabe os detalhes listados ou se ele inventa coisas (alucina)."

    tester_messages = [
        {"role": "system", "content": system_content}
    ]
    
    for msg in request.history[-12:]: 
        role = "assistant" if msg["role"] == "user" else "user" 
        tester_messages.append({"role": role, "content": msg["content"]})
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=tester_messages,
            response_format={"type": "json_object"},
            temperature=0.8
        )
        res_data = json.loads(response.choices[0].message.content)
        await _log_tester_cost(db, "gpt-4o-mini", response.usage, "Provocação", session_id=request.session_id or "SYS_TESTER")

        # --- TAG SESSION AS TEST SESSION ---
        if request.session_id:
            try:
                # Upsert session summary to mark as test
                sum_stmt = select(SessionSummary).where(SessionSummary.session_id == request.session_id)
                sum_res = await db.execute(sum_stmt)
                summary = sum_res.scalars().first()
                if not summary:
                    summary = SessionSummary(session_id=request.session_id, agent_id=request.agent_id or 0, summary_text="Sessão de Teste Automático", is_test_session=True)
                    db.add(summary)
                else:
                    summary.is_test_session = True
                await db.commit()
            except Exception as e:
                logger.error(f"Erro ao marcar sessão como teste: {e}")

        return res_data # Retorna {"provocation": "...", "sentiment": 50}
    except Exception as e:
        logger.warning(f"Erro no provoke com OpenAI, tentando fallback Gemini: {e}")
        try:
            gemini_client = get_openai_client("gemini-1.5-flash")
            response = await gemini_client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=tester_messages,
                response_format={"type": "json_object"},
                temperature=0.8
            )
            res_data = json.loads(response.choices[0].message.content)
            await _log_tester_cost(db, "gemini-1.5-flash", getattr(response, 'usage', None), "Provocação (Fallback)")
            return res_data
        except Exception as e2:
            logger.error(f"Erro fatal no provoke: {e2}")
            return {"provocation": "Não entendi sua resposta. Pode repetir?", "sentiment": 40}

@app.post("/tester/evaluate")
async def evaluate_test_session(
    request: TesterEvaluationRequest, 
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_api_key)
):
    client = get_openai_client()
    if not client:
         raise HTTPException(status_code=500, detail="OpenAI Client not configured")
    
    history_text = ""
    for m in request.history:
        role = "Usuário (Tester)" if m["role"] == "user" else "Agente"
        history_text += f"{role}: {m['content']}\n"

    system_prompt = f"""Você é um Auditor Especialista em IA e Experiência do Cliente. 
Analise a conversa abaixo entre um Agente de IA e um Testador que agiu como: {request.persona_prompt}.

Gere um relatório estruturado estritamente em JSON com o seguinte formato:
{{
  "score": 10,
  "strengths": ["ponto 1", "ponto 2", "ponto 3"],
  "weaknesses": ["falha 1", "falha 2", "falha 3"],
  "recommendation": "dica para o prompt"
}}
Analise baseada no cenário: {request.persona_prompt}.

CONVERSA:
{history_text}
"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_prompt}],
            response_format={"type": "json_object"}
        )
        res_data = json.loads(response.choices[0].message.content)
        await _log_tester_cost(db, "gpt-4o-mini", response.usage, "Avaliação", session_id=request.session_id or "SYS_TESTER")

        # --- SAVE TEST REPORT TO DB ---
        if request.session_id:
            try:
                sum_stmt = select(SessionSummary).where(SessionSummary.session_id == request.session_id)
                sum_res = await db.execute(sum_stmt)
                summary = sum_res.scalars().first()
                if not summary:
                    summary = SessionSummary(
                        session_id=request.session_id, 
                        agent_id=request.agent_id or 0, 
                        summary_text="Sessão de Teste Automático", 
                        is_test_session=True,
                        test_report=res_data
                    )
                    db.add(summary)
                else:
                    summary.test_report = res_data
                    summary.is_test_session = True
                await db.commit()
            except Exception as e:
                logger.error(f"Erro ao salvar relatório de teste: {e}")

        return res_data
    except Exception as e:
        logger.warning(f"Erro na avaliação com OpenAI, tentando fallback Gemini: {e}")
        try:
            gemini_client = get_openai_client("gemini-1.5-flash")
            response = await gemini_client.chat.completions.create(
                model="gemini-1.5-flash",
                messages=[{"role": "system", "content": system_prompt}],
                response_format={"type": "json_object"}
            )
            res_data = json.loads(response.choices[0].message.content)
            await _log_tester_cost(db, "gemini-1.5-flash", getattr(response, 'usage', None), "Avaliação (Fallback)")
            return res_data
        except Exception as e2:
            logger.error(f"Erro fatal na avaliação: {e2}")
            raise HTTPException(status_code=500, detail="Falha ao gerar relatório")

@app.post("/tester/sentiment")
async def analyze_sentiment(
    request: TesterSentimentRequest, 
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_api_key)
):
    client = get_openai_client()
    if not client:
        return {"sentiment": 50}
    
    system_content = """Você é um Analista de Sentimento Focado Exclusivamente no 'Nível de Paciência' do cliente com o ATENDIMENTO do agente.
- 100%: Encantado, satisfeitíssimo, problema resolvido.
- 70-80%: Cliente engajado, recebendo orientação de forma tranquila.
- 50-60%: Cliente expressando dificuldade para usar um produto (ISSO ├ë NORMAL, N├âO DIMINUA A NOTA S├ô POR ISSO).
- 30-40%: Cliente levemente irritado com a demora ou com o Agente não entendendo sua pergunta.
- 0-20%: Cliente furioso com a qualidade do BOT/Agente, xingando ou desistindo de ser atendido.

REGRA DE OURO: Se o cliente disser "não consigo fazer isso" ou "é difícil", mas o tom não for de xingamento contra o agente, mantenha a nota de paciência alta (ex: 60-70), pois ele está sendo apenas vulnerável e pediu ajuda, e N├âO que perdeu a paciência com você. Retorne APENAS um JSON: {"sentiment": <0-100>}"""
    
    tester_messages = [{"role": "system", "content": system_content}]
    
    # Send only the last 6 messages to save tokens and focus context
    for msg in request.history[-6:]:
        tester_messages.append({"role": msg["role"], "content": msg["content"]})
        
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=tester_messages,
            response_format={"type": "json_object"},
            temperature=0.2
        )
        res_data = json.loads(response.choices[0].message.content)
        await _log_tester_cost(db, "gpt-4o-mini", response.usage, "Sentimento")
        return {"sentiment": res_data.get("sentiment", 50)}
    except Exception as e:
        logger.error(f"Erro na analise de sentimento purificada: {e}")
        return {"sentiment": 50}
        
@app.get("/sessions/{session_id}/test-report")
async def get_test_report(session_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(SessionSummary).where(SessionSummary.session_id == session_id)
    res = await db.execute(stmt)
    summary = res.scalars().first()
    if not summary or not summary.test_report:
        return {"error": "Relatório não encontrado"}
    return summary.test_report

@app.get("/sessions", response_model=List[SessionPreview], dependencies=[Depends(verify_api_key)])
async def list_sessions(agent_id: int | None = None, db: AsyncSession = Depends(get_db)):
    # Subquery to find stats per session
    query = (
        select(
            InteractionLog.session_id,
            InteractionLog.agent_id,
            func.min(InteractionLog.timestamp).label("start_time"),
            func.max(InteractionLog.timestamp).label("last_interaction"),
            func.count(InteractionLog.id).label("message_count"),
            func.sum(InteractionLog.cost_brl).label("total_cost")
        )
        .group_by(InteractionLog.session_id, InteractionLog.agent_id)
        .order_by(func.max(InteractionLog.timestamp).desc())
    )
    
    if agent_id:
        query = query.where(InteractionLog.agent_id == agent_id)
        
    result = await db.execute(query)
    rows = result.all()
    
    # Get agent names map and summaries map
    # Optimization: fetch summaries in bulk
    session_ids = [row.session_id for row in rows]
    
    summaries = {}
    if session_ids:
        sum_result = await db.execute(select(SessionSummary).where(SessionSummary.session_id.in_(session_ids)))
        for s in sum_result.scalars().all():
            summaries[s.session_id] = {
                "text": s.summary_text,
                "is_tester": s.is_test_session
            }
            
    # Get Agent Names
    agent_ids = list(set([row.agent_id for row in rows]))
    agent_names = {}
    if agent_ids:
        ag_result = await db.execute(select(AgentConfigModel.id, AgentConfigModel.name).where(AgentConfigModel.id.in_(agent_ids)))
        for a_id, a_name in ag_result.all():
            agent_names[a_id] = a_name

    sessions = []
    for row in rows:
        summary_data = summaries.get(row.session_id, {})
        sessions.append(SessionPreview(
            session_id=row.session_id,
            agent_id=row.agent_id,
            agent_name=agent_names.get(row.agent_id, "Unknown"),
            start_time=row.start_time.replace(tzinfo=timezone.utc) if row.start_time else row.start_time,
            last_interaction=row.last_interaction.replace(tzinfo=timezone.utc) if row.last_interaction else row.last_interaction,
            message_count=row.message_count,
            summary=summary_data.get("text", "Sem resumo disponível"),
            total_cost=row.total_cost or 0.0,
            is_test_session=summary_data.get("is_tester", False)
        ))
        
    return sessions

@app.get("/sessions/{session_id}/messages", response_model=List[SessionMessage], dependencies=[Depends(verify_api_key)])
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InteractionLog)
        .where(InteractionLog.session_id == session_id)
        .order_by(InteractionLog.timestamp.asc())
    )
    logs = result.scalars().all()
    
    messages = []
    for log in logs:
        # User message
        messages.append(SessionMessage(
            role="user",
            content=log.user_message,
            timestamp=log.timestamp.replace(tzinfo=timezone.utc) if log.timestamp else log.timestamp,
            cost=0,
            tokens=log.input_tokens,
            input_tokens=log.input_tokens,
            output_tokens=0,
            model=None
        ))
        # Agent response
        messages.append(SessionMessage(
            role="assistant",
            content=log.agent_response,
            timestamp=log.timestamp.replace(tzinfo=timezone.utc) if log.timestamp else log.timestamp, # Same timestamp approx
            cost=log.cost_brl,
            tokens=log.input_tokens + log.output_tokens,
            input_tokens=log.input_tokens,
            output_tokens=log.output_tokens,
            model=log.model_used,
            debug=json.loads(log.debug_info) if log.debug_info else None
        ))
        
    return messages

@app.get("/shared/session/{session_id}")
async def get_shared_session(session_id: str, db: AsyncSession = Depends(get_db)):
    # Retrieve interaction logs for the session
    result_logs = await db.execute(
        select(InteractionLog)
        .where(InteractionLog.session_id == session_id)
        .order_by(InteractionLog.timestamp.asc())
    )
    logs = result_logs.scalars().all()

    if not logs:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    # Get Agent info
    agent_id = logs[0].agent_id
    result_agent = await db.execute(select(AgentConfigModel.name).where(AgentConfigModel.id == agent_id))
    agent_name = result_agent.scalar() or "Agente"

    messages = []
    for log in logs:
        # User message
        messages.append({
            "role": "user",
            "content": log.user_message,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        })
        # Agent response
        messages.append({
            "role": "assistant",
            "content": log.agent_response,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "model": log.model_used
        })
        
    return {
        "agent_name": agent_name,
        "messages": messages
    }

@app.get("/agents/{agent_id}/history", dependencies=[Depends(verify_api_key)])
async def get_agent_history(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InteractionLog)
        .where(InteractionLog.agent_id == agent_id)
        .order_by(InteractionLog.timestamp.desc())
        .limit(100)
    )
    logs = result.scalars().all()
    return logs

@app.get("/sessions/{session_id}/summarize", dependencies=[Depends(verify_api_key)])
async def summarize_session(session_id: str, db: AsyncSession = Depends(get_db)):
    # 1. Verificar se já existe um resumo salvo
    existing_result = await db.execute(select(SessionSummary).where(SessionSummary.session_id == session_id))
    existing_summary = existing_result.scalars().first()
    
    if existing_summary:
        print(f"­ƒôä Resumo recuperado do banco para a sessão: {session_id}")
        return {
            "summary": existing_summary.summary_text,
            "is_cached": True,
            "usage": {
                "total_tokens": (existing_summary.input_tokens or 0) + (existing_summary.output_tokens or 0)
            },
            "cost_brl": existing_summary.cost_brl or 0.0
        }

    # 2. Se não existir, buscar logs para gerar um novo
    result = await db.execute(
        select(InteractionLog)
        .where(InteractionLog.session_id == session_id)
        .order_by(InteractionLog.timestamp.asc())
    )
    logs = result.scalars().all()
    
    if not logs:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Format to history format expected by summarize_history
    history = []
    for log in logs:
        history.append({"role": "user", "content": log.user_message})
        history.append({"role": "assistant", "content": log.agent_response})
    
    result_data = await summarize_history(history)
    summary_text = result_data["text"]
    usage = result_data["usage"]
    
    cost_usd = 0.0
    cost_brl = 0.0
    
    if usage:
        cost_usd = calculate_cost("gpt-4o-mini", usage.prompt_tokens, usage.completion_tokens)
        cost_brl = cost_usd * USD_TO_BRL

    # 3. Salvar o novo resumo no banco
    if "Falha" not in summary_text and "Erro" not in summary_text:
        new_summary = SessionSummary(
            session_id=session_id,
            agent_id=logs[0].agent_id,
            summary_text=summary_text,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            cost_usd=cost_usd,
            cost_brl=cost_brl
        )
        db.add(new_summary)
        await db.commit()
        print(f"✅ Novo resumo salvo para a sessão: {session_id}")

    return {
        "summary": summary_text,
        "is_cached": False,
        "usage": {
            "total_tokens": usage.total_tokens if usage else 0
        },
        "cost_brl": cost_brl
    }

@app.get("/sessions/{session_id}/questions", dependencies=[Depends(verify_api_key)])
async def extract_session_questions(session_id: str, db: AsyncSession = Depends(get_db)):
    # Buscar logs
    result = await db.execute(
        select(InteractionLog)
        .where(InteractionLog.session_id == session_id)
        .order_by(InteractionLog.timestamp.asc())
    )
    logs = result.scalars().all()
    
    if not logs:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Format
    history = []
    for log in logs:
        if log.user_message:
            history.append({"role": "user", "content": log.user_message})
    
    result_data = await extract_questions_from_history(history)
    
    return result_data

@app.get("/global-variables", response_model=List[GlobalContextVariable], dependencies=[Depends(verify_api_key)])
async def list_global_variables(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GlobalContextVariableModel).order_by(GlobalContextVariableModel.is_default.desc(), GlobalContextVariableModel.key))
    variables = result.scalars().all()
    
    # If empty, initialize defaults
    if not variables:
        defaults = [
            {"key": "contact_name", "value": "Usuário Teste", "description": "Nome do contato para personalização.", "is_default": True},
            {"key": "contact_phone", "value": "5511999999999", "description": "Telefone do contato.", "is_default": True}
        ]
        for d in defaults:
            db.add(GlobalContextVariableModel(**d))
        await db.commit()
        result = await db.execute(select(GlobalContextVariableModel).order_by(GlobalContextVariableModel.is_default.desc(), GlobalContextVariableModel.key))
        variables = result.scalars().all()
        
    return variables

@app.post("/global-variables", response_model=GlobalContextVariable, dependencies=[Depends(verify_api_key)])
async def create_global_variable(variable: GlobalContextVariable, db: AsyncSession = Depends(get_db)):
    db_var = GlobalContextVariableModel(
        key=variable.key,
        value=variable.value,
        type=variable.type or "string",
        description=variable.description,
        is_default=False
    )
    db.add(db_var)
    try:
        await db.commit()
        await db.refresh(db_var)
        return db_var
    except Exception as e:
        await db.rollback()
        error_msg = str(e)
        if "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
            raise HTTPException(status_code=400, detail=f"A chave '{variable.key}' já existe no sistema.")
        raise HTTPException(status_code=400, detail=f"Erro ao salvar variável: {error_msg}")

@app.put("/global-variables/{var_id}", response_model=GlobalContextVariable, dependencies=[Depends(verify_api_key)])
async def update_global_variable(var_id: int, variable: GlobalContextVariable, db: AsyncSession = Depends(get_db)):
    db_var = await db.get(GlobalContextVariableModel, var_id)
    if not db_var:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    db_var.value = variable.value
    db_var.description = variable.description
    db_var.type = variable.type or "string"
    # key should probably be immutable or check for duplicates if changed
    if not db_var.is_default:
        db_var.key = variable.key
        
    await db.commit()
    await db.refresh(db_var)
    return db_var

@app.delete("/global-variables/{var_id}", dependencies=[Depends(verify_api_key)])
async def delete_global_variable(var_id: int, db: AsyncSession = Depends(get_db)):
    db_var = await db.get(GlobalContextVariableModel, var_id)
    if not db_var:
        raise HTTPException(status_code=404, detail="Variable not found")
    if db_var.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default variables")
    
    await db.delete(db_var)
    await db.commit()
    return {"status": "success"}

@app.get("/dashboard/stats", response_model=DashboardStats, dependencies=[Depends(verify_api_key)])
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    result_agents = await db.execute(select(func.count(AgentConfigModel.id)).where(AgentConfigModel.is_active == True))
    total_agents = result_agents.scalar() or 0

    result_kbs = await db.execute(select(func.count(KnowledgeBaseModel.id)))
    total_kbs = result_kbs.scalar() or 0

    result_interactions = await db.execute(select(func.count(InteractionLog.id)))
    total_interactions = result_interactions.scalar() or 0

    # Sum cost_brl from InteractionLog (more accurate for total history)
    result_cost = await db.execute(select(func.sum(InteractionLog.cost_brl)))
    total_cost = result_cost.scalar() or 0.0

    return {
        "total_agents": total_agents,
        "total_knowledge_bases": total_kbs,
        "total_interactions": total_interactions,
        "total_cost": total_cost,
    }

class DeleteSessionsRequest(BaseModel):
    session_ids: List[str]

@app.delete("/sessions", dependencies=[Depends(verify_api_key)])
async def delete_sessions_v2(request: DeleteSessionsRequest, db: AsyncSession = Depends(get_db)):
    if not request.session_ids:
        return {"message": "No session IDs provided"}
        
    # Delete logs
    await db.execute(
        delete(InteractionLog).where(InteractionLog.session_id.in_(request.session_ids))
    )
    # Delete summaries
    await db.execute(
        delete(SessionSummary).where(SessionSummary.session_id.in_(request.session_ids))
    )
    await db.commit()
    return {"message": f"{len(request.session_ids)} sess├Áes deletadas"}

@app.get("/financial/report", response_model=FinancialReport, dependencies=[Depends(verify_api_key)])
async def get_financial_report(
    start_date: str | None = None,
    end_date: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    # Group by date and agent, adjusting for Brazil timezone (GMT-3)
    tz_aware_timestamp = text("interaction_logs.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'")
    date_field = func.date(tz_aware_timestamp)
    
    query = (
        select(
            date_field.label("day"),
            InteractionLog.agent_id,
            AgentConfigModel.name.label("agent_name"),
            InteractionLog.model_used,
            func.count(InteractionLog.id).label("messages"),
            func.sum(InteractionLog.input_tokens + InteractionLog.output_tokens).label("tokens"),
            func.sum(InteractionLog.cost_brl).label("cost"),
            func.count(InteractionLog.session_id.distinct()).label("unique_sessions")
        )
        .outerjoin(AgentConfigModel, InteractionLog.agent_id == AgentConfigModel.id)
    )

    if start_date:
        query = query.where(date_field >= func.date(start_date))
    if end_date:
        query = query.where(date_field <= func.date(end_date))

    query = (
        query.group_by(date_field, InteractionLog.agent_id, AgentConfigModel.name, InteractionLog.model_used)
        .order_by(date_field.desc(), AgentConfigModel.name, InteractionLog.model_used)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    items = []
    grand_total = 0.0
    for row in rows:
        cost = float(row.cost or 0.0)
        messages = int(row.messages or 0)
        items.append({
            "date": str(row.day),
            "agent_id": row.agent_id,
            "agent_name": f"{row.agent_name or 'Sistema / IA Interna'} ({row.model_used or 'N/A'})",
            "model_used": row.model_used,
            "total_messages": messages,
            "total_tokens": int(row.tokens or 0),
            "total_cost": cost,
            "avg_cost_per_message": cost / messages if messages > 0 else 0.0,
            "unique_sessions": int(row.unique_sessions or 0)
        })
        grand_total += cost
        
    return {
        "items": items,
        "grand_total_cost": grand_total
    }


# ============================================================
# ­ƒÅ¡ FINE-TUNING PIPELINE ÔÇö Endpoints de Feedback e Treinamento
# ============================================================

from models import FeedbackLog
import os

class FeedbackCreate(BaseModel):
    agent_id: int
    interaction_log_id: int | None = None
    user_message: str
    original_response: str
    rating: str = "negative"            # 'positive' | 'negative'
    corrected_response: str | None = None
    system_prompt_snapshot: str | None = None
    correction_note: str | None = None

class FeedbackResponse(BaseModel):
    id: int
    agent_id: int
    interaction_log_id: int | None
    user_message: str
    original_response: str | None
    corrected_response: str | None
    rating: str
    correction_note: str | None
    exported_to_finetune: bool
    finetune_job_id: str | None
    created_at: datetime

    class Config:
        from_attributes = True

@app.post("/feedback", response_model=FeedbackResponse, dependencies=[Depends(verify_api_key)])
async def create_feedback(payload: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    """Salva um registro de feedback (­ƒæì ou ­ƒæÄ) com a correção opcional."""
    log = FeedbackLog(
        agent_id=payload.agent_id,
        interaction_log_id=payload.interaction_log_id,
        user_message=payload.user_message,
        original_response=payload.original_response,
        corrected_response=payload.corrected_response,
        rating=payload.rating,
        system_prompt_snapshot=payload.system_prompt_snapshot,
        correction_note=payload.correction_note,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log

@app.get("/feedback", dependencies=[Depends(verify_api_key)])
async def list_feedback(agent_id: int | None = None, rating: str | None = None, exported: bool | None = None, db: AsyncSession = Depends(get_db)):
    """Lista os registros de feedback. Filtra por agente, rating e status de exportação."""
    query = select(FeedbackLog).order_by(FeedbackLog.created_at.desc())
    if agent_id:
        query = query.where(FeedbackLog.agent_id == agent_id)
    if rating:
        query = query.where(FeedbackLog.rating == rating)
    if exported is not None:
        query = query.where(FeedbackLog.exported_to_finetune == exported)
    result = await db.execute(query)
    rows = result.scalars().all()

    # Enriquecer com nome do agente
    agent_ids = list(set(r.agent_id for r in rows))
    agent_names = {}
    if agent_ids:
        ag_res = await db.execute(select(AgentConfigModel.id, AgentConfigModel.name).where(AgentConfigModel.id.in_(agent_ids)))
        for a_id, a_name in ag_res.all():
            agent_names[a_id] = a_name

    return [
        {
            "id": r.id,
            "agent_id": r.agent_id,
            "agent_name": agent_names.get(r.agent_id, "Agente Excluído"),
            "interaction_log_id": r.interaction_log_id,
            "user_message": r.user_message,
            "original_response": r.original_response,
            "corrected_response": r.corrected_response,
            "rating": r.rating,
            "correction_note": r.correction_note,
            "exported_to_finetune": r.exported_to_finetune,
            "finetune_job_id": r.finetune_job_id,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]

@app.delete("/feedback/{feedback_id}", dependencies=[Depends(verify_api_key)])
async def delete_feedback(feedback_id: int, db: AsyncSession = Depends(get_db)):
    """Remove um registro de feedback do dataset."""
    result = await db.execute(select(FeedbackLog).where(FeedbackLog.id == feedback_id))
    log = result.scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Feedback não encontrado")
    await db.delete(log)
    await db.commit()
    return {"message": "Feedback removido"}

class FeedbackUpdate(BaseModel):
    user_message: str | None = None
    corrected_response: str | None = None
    correction_note: str | None = None

@app.patch("/feedback/{feedback_id}", dependencies=[Depends(verify_api_key)])
async def update_feedback(feedback_id: int, payload: FeedbackUpdate, db: AsyncSession = Depends(get_db)):
    """Atualiza a pergunta e/ou resposta corrigida de um registro de feedback."""
    result = await db.execute(select(FeedbackLog).where(FeedbackLog.id == feedback_id))
    log = result.scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Feedback não encontrado")
    if payload.user_message is not None:
        log.user_message = payload.user_message
    if payload.corrected_response is not None:
        log.corrected_response = payload.corrected_response
    if payload.correction_note is not None:
        log.correction_note = payload.correction_note
    await db.commit()
    await db.refresh(log)
    return {
        "id": log.id,
        "user_message": log.user_message,
        "corrected_response": log.corrected_response,
        "correction_note": log.correction_note,
        "message": "Atualizado com sucesso"
    }

@app.get("/feedback/export/{agent_id}", dependencies=[Depends(verify_api_key)])
async def export_feedback_jsonl(agent_id: int, db: AsyncSession = Depends(get_db)):
    """
    Exporta o dataset de fine-tuning no formato JSONL da OpenAI.
    Retorna apenas registros negativos com resposta corrigida (pares completos).
    """
    result = await db.execute(
        select(FeedbackLog)
        .where(
            FeedbackLog.agent_id == agent_id,
            FeedbackLog.corrected_response != None,
            FeedbackLog.corrected_response != ""
        )
        .order_by(FeedbackLog.created_at.asc())
    )
    logs = result.scalars().all()

    if not logs:
        raise HTTPException(status_code=404, detail="Nenhum exemplo de treinamento disponível. Adicione correç├Áes primeiro.")

    lines = []
    for log in logs:
        system_content = log.system_prompt_snapshot or "Você é um assistente inteligente e prestativo."
        entry = {
            "messages": [
                {"role": "system",    "content": system_content},
                {"role": "user",      "content": log.user_message},
                {"role": "assistant", "content": log.corrected_response}
            ]
        }
        lines.append(json.dumps(entry, ensure_ascii=False))

    jsonl_content = "\n".join(lines)

    from fastapi.responses import Response
    return Response(
        content=jsonl_content,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f"attachment; filename=finetune_agent_{agent_id}.jsonl"}
    )


# --- Fine-Tuning Jobs (integração OpenAI) ---

class FineTuneJobCreate(BaseModel):
    agent_id: int
    base_model: str = "gpt-4o-mini-2024-07-18"
    n_epochs: int = 3
    suffix: str | None = None

@app.post("/fine-tuning/start", dependencies=[Depends(verify_api_key)])
async def start_finetune_job(payload: FineTuneJobCreate, db: AsyncSession = Depends(get_db)):
    """
    Faz upload do dataset para OpenAI e inicia um job de fine-tuning.
    Requisito: precisa ter registros de feedback com corrected_response.
    """
    import openai

    # 1. Coletar todos os exemplos válidos para treino:
    #    - Negativos com resposta corrigida (ensina o modelo o que fazer diferente)
    #    - Positivos com resposta original (reforça o que o modelo já faz bem)
    result = await db.execute(
        select(FeedbackLog)
        .where(
            FeedbackLog.agent_id == payload.agent_id,
        )
    )
    all_logs = result.scalars().all()

    # Filtra exemplos válidos para o JSONL
    logs = [
        log for log in all_logs
        if (log.rating == 'negative' and log.corrected_response and log.corrected_response.strip())
        or (log.rating == 'positive' and log.original_response and log.original_response.strip())
    ]

    if len(logs) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Mínimo de 10 exemplos necessários. Você tem {len(logs)}. Continue coletando feedback."
        )

    # 2. Gerar JSONL em memória
    lines = []
    for log in logs:
        system_content = log.system_prompt_snapshot or "Você é um assistente inteligente e prestativo."
        # Para negativos usa a resposta corrigida; para positivos reforça a resposta original
        target_response = log.corrected_response if (log.rating == 'negative' and log.corrected_response) else log.original_response
        entry = {
            "messages": [
                {"role": "system",    "content": system_content},
                {"role": "user",      "content": log.user_message},
                {"role": "assistant", "content": target_response}
            ]
        }
        lines.append(json.dumps(entry, ensure_ascii=False))

    jsonl_bytes = "\n".join(lines).encode("utf-8")

    # 3. Upload para OpenAI
    client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    import io
    file_obj = io.BytesIO(jsonl_bytes)
    file_obj.name = f"finetune_agent_{payload.agent_id}.jsonl"

    uploaded_file = await client.files.create(file=file_obj, purpose="fine-tune")

    # 4. Criar o job de fine-tuning
    job = await client.fine_tuning.jobs.create(
        training_file=uploaded_file.id,
        model=payload.base_model,
        hyperparameters={"n_epochs": payload.n_epochs},
        suffix=payload.suffix if payload.suffix else None
    )

    # 5. Marcar registros como exportados
    for log in logs:
        log.exported_to_finetune = True
        log.finetune_job_id = job.id

    await db.commit()

    return {
        "job_id": job.id,
        "status": job.status,
        "model": job.model,
        "training_file": uploaded_file.id,
        "examples_count": len(logs),
        "created_at": job.created_at,
    }

@app.get("/fine-tuning/jobs", dependencies=[Depends(verify_api_key)])
async def list_finetune_jobs():
    """Lista todos os jobs de fine-tuning na conta OpenAI, verificando se o modelo ainda existe."""
    import openai
    client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    try:
        # Busca os jobs recentes
        jobs_page = await client.fine_tuning.jobs.list(limit=20)
        
        # Busca os modelos realmente disponíveis na conta para cruzar dados
        models_page = await client.models.list()
        available_models = {m.id for m in models_page.data}
        
        return [
            {
                "id": j.id,
                "model": j.model,
                "fine_tuned_model": j.fine_tuned_model,
                "is_model_available": j.fine_tuned_model in available_models if j.fine_tuned_model else False,
                "status": j.status,
                "trained_tokens": j.trained_tokens,
                "created_at": j.created_at,
                "finished_at": j.finished_at,
                "error": j.error.message if j.error else None,
            }
            for j in jobs_page.data
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fine-tuning/jobs/{job_id}", dependencies=[Depends(verify_api_key)])
async def get_finetune_job(job_id: str):
    """Retorna o status detalhado de um job de fine-tuning."""
    import openai
    client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    try:
        j = await client.fine_tuning.jobs.retrieve(job_id)
        return {
            "id": j.id,
            "model": j.model,
            "fine_tuned_model": j.fine_tuned_model,
            "status": j.status,
            "trained_tokens": j.trained_tokens,
            "created_at": j.created_at,
            "finished_at": j.finished_at,
            "error": j.error.message if j.error else None,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/fine-tuning/cleanup-checkpoints", dependencies=[Depends(verify_api_key)])
async def cleanup_checkpoints():
    """Varre a conta OpenAI e deleta todos os modelos que são checkpoints (:ckpt-)."""
    import openai
    client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    try:
        models_page = await client.models.list()
        checkpoints = [m.id for m in models_page.data if ":ckpt-" in m.id]
        
        deleted = []
        for ckpt_id in checkpoints:
            try:
                await client.models.delete(ckpt_id)
                deleted.append(ckpt_id)
            except:
                pass
                
        return {"message": f"Limpeza concluída. {len(deleted)} checkpoints removidos.", "deleted": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/fine-tuning/models", dependencies=[Depends(verify_api_key)])
async def list_finetuned_models():
    """Lista todos os modelos fine-tuned disponíveis na conta (para usar nos agentes)."""
    import openai
    client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    try:
        models_page = await client.models.list()
        # Filtra apenas modelos que começam com ft: (fine-tuned) e ignora checkpoints na listagem padrão para não poluir
        ft_models = [m for m in models_page.data if m.id.startswith("ft:") and ":ckpt-" not in m.id]
        return [{"id": m.id, "created": m.created} for m in ft_models]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/fine-tuning/models/{model_id:path}", dependencies=[Depends(verify_api_key)])
async def delete_finetuned_model(model_id: str):
    """
    Deleta um modelo fine-tuned e TODOS os seus checkpoints relacionados da conta OpenAI.
    Isso garante que o modelo suma de vez de ferramentas como n8n.
    """
    import openai
    client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    deleted_ids = []
    try:
        # 1. Tentar deletar o modelo principal solicitado
        try:
            await client.models.delete(model_id)
            deleted_ids.append(model_id)
        except openai.NotFoundError:
            pass # Já não existia

        # 2. Buscar e deletar checkpoints relacionados
        # O ID costuma ser algo como ft:base:org:suffix:JOB_ID ou ft:base:org::JOB_ID
        # Extraímos o que parece ser o identificador único do job/modelo
        parts = model_id.split(':')
        job_part = parts[-1] if parts else None
        
        if job_part:
            all_models = await client.models.list()
            # Procura modelos que contenham o mesmo JOB_ID e sejam checkpoints
            related_ckpts = [
                m.id for m in all_models.data 
                if job_part in m.id and m.id != model_id
            ]
            
            for ckpt_id in related_ckpts:
                try:
                    await client.models.delete(ckpt_id)
                    deleted_ids.append(ckpt_id)
                except:
                    pass

        return {
            "deleted": True, 
            "id": model_id, 
            "related_deleted": deleted_ids,
            "message": f"Modelo e {len(deleted_ids)-1} checkpoints removidos com sucesso."
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/system/reset-database", dependencies=[Depends(verify_api_key), Depends(get_current_user)])
async def reset_database(db: AsyncSession = Depends(get_db)):
    """
    ⚠️´©Å A├ç├âO CR├ìTICA: Limpa todos os dados de todas as tabelas do sistema,
    preservando apenas a estrutura e os usuários.
    """
    try:
        tables = [
            "interaction_logs", "session_summaries", "feedback_logs",
            "prompt_drafts", "agent_tools", "agent_knowledge_bases",
            "knowledge_items", "knowledge_bases", "google_tokens",
            "user_memory", "global_context_variables", "agent_config",
            "tools"
        ]
        
        # Tenta TRUNCATE em bloco primeiro (mais rápido e reseta IDs)
        try:
            # PostgreSQL permite truncar várias tabelas de uma vez com CASCADE
            tables_str = ", ".join(tables)
            await db.execute(text(f"TRUNCATE TABLE {tables_str} RESTART IDENTITY CASCADE"))
            
            # Limpeza total de usuários (O acesso Super Admin continua via .env)
            await db.execute(text("DELETE FROM users"))
            
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Truncate falhou (provavelmente lock), tentando via Delete: {e}")
            
            # Fallback: Deleta um por um se o truncate falhar
            for table in tables:
                try:
                    await db.execute(text(f"DELETE FROM {table}"))
                except Exception as del_err:
                    print(f"Erro ao deletar {table}: {del_err}")
            
            # Limpeza total de usuários no fallback também
            await db.execute(text("DELETE FROM users"))
            await db.commit()
            
        return {"status": "success", "message": "All data wiped"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- UNANSWERED QUESTIONS ROUTES ---

@app.get("/unanswered-questions")
async def get_unanswered_questions(
    status: str = "PENDENTE", 
    limit: int = 50, 
    offset: int = 0, 
    db: AsyncSession = Depends(get_db), 
    _: None = Depends(verify_api_key)
):
    try:
        from sqlalchemy.orm import selectinload
        # Fetching with agent details if needed
        stmt = select(UnansweredQuestionModel).where(
            UnansweredQuestionModel.status == status
        ).order_by(UnansweredQuestionModel.created_at.desc()).limit(limit).offset(offset)
        
        result = await db.execute(stmt)
        questions = result.scalars().all()
        
        return {
            "success": True, 
            "items": [{
                "id": q.id,
                "agent_id": q.agent_id,
                "session_id": q.session_id,
                "question": q.question,
                "context": q.context,
                "status": q.status,
                "created_at": q.created_at.isoformat() if q.created_at else None
            } for q in questions]
        }
    except Exception as e:
        logger.error(f"Error fetching unanswered questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AnswerUnansweredRequest(BaseModel):
    answer: str
    knowledge_base_id: int
    question: Optional[str] = None # Para permitir edição antes de salvar

@app.post("/unanswered-questions/{question_id}/answer")
async def answer_unanswered_question(
    question_id: int, 
    req: AnswerUnansweredRequest, 
    db: AsyncSession = Depends(get_db), 
    _: None = Depends(verify_api_key)
):
    try:
        # Check if question exists
        q_result = await db.execute(select(UnansweredQuestionModel).where(UnansweredQuestionModel.id == question_id))
        question_record = q_result.scalar_one_or_none()
        
        if not question_record:
            raise HTTPException(status_code=404, detail="Pergunta não encontrada.")
            
        # Check if KB exists
        kb_result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == req.knowledge_base_id))
        if not kb_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Base de Conhecimento não encontrada.")
            
        # 1. Create Knowledge Item
        # Use updated question if provided, else use original
        final_question = req.question if req.question else question_record.question
        emb, _ = await get_embedding(final_question)
        
        new_item = KnowledgeItemModel(
            knowledge_base_id=req.knowledge_base_id,
            question=final_question,
            answer=req.answer,
            category="Inbox", # Default category to show it came from this flow
            embedding=emb
        )
        db.add(new_item)
        
        # 2. Update Question Status
        question_record.status = "RESPONDIDA"
        question_record.updated_at = datetime.utcnow()
        
        await db.commit()
        
        return {"success": True, "message": "Pergunta respondida e adicionada à base de conhecimento."}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error answering question {question_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/unanswered-questions/{question_id}/discard")
async def discard_unanswered_question(
    question_id: int, 
    db: AsyncSession = Depends(get_db), 
    _: None = Depends(verify_api_key)
):
    try:
        q_result = await db.execute(select(UnansweredQuestionModel).where(UnansweredQuestionModel.id == question_id))
        question_record = q_result.scalar_one_or_none()
        
        if not question_record:
            raise HTTPException(status_code=404, detail="Pergunta não encontrada.")
            
        question_record.status = "DESCARTADA"
        question_record.updated_at = datetime.utcnow()
        
        await db.commit()
        
        return {"success": True, "message": "Pergunta descartada com sucesso."}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error discarding question {question_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================
# --- ROTAS DE SUPORTE HUMANO ---
# =============================================

@app.get("/support-requests", dependencies=[Depends(verify_api_key)])
async def list_support_requests(db: AsyncSession = Depends(get_db)):
    """Lista todos os pedidos de suporte humano em aberto."""
    result = await db.execute(
        select(SupportRequestModel, AgentConfigModel.name.label("agent_name"))
        .join(AgentConfigModel, SupportRequestModel.agent_id == AgentConfigModel.id, isouter=True)
        .where(SupportRequestModel.status == "OPEN")
        .order_by(SupportRequestModel.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": r.SupportRequestModel.id,
            "agent_id": r.SupportRequestModel.agent_id,
            "agent_name": r.agent_name or "Agente Excluído",
            "session_id": r.SupportRequestModel.session_id,
            "user_name": r.SupportRequestModel.user_name,
            "user_email": r.SupportRequestModel.user_email,
            "status": r.SupportRequestModel.status,
            "summary": r.SupportRequestModel.summary,
            "reason": r.SupportRequestModel.reason,
            "extracted_data": r.SupportRequestModel.extracted_data or {},
            "created_at": r.SupportRequestModel.created_at.isoformat() if r.SupportRequestModel.created_at else None,
        }
        for r in rows
    ]

@app.patch("/support-requests/{support_id}/resolve", dependencies=[Depends(verify_api_key)])
async def resolve_support_request(support_id: int, db: AsyncSession = Depends(get_db)):
    """Marca uma solicitação de suporte como resolvida (remove da fila)."""
    result = await db.execute(select(SupportRequestModel).where(SupportRequestModel.id == support_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    req.status = "RESOLVED"
    req.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True, "message": "Atendimento finalizado."}

class SupportSummaryRequest(BaseModel):
    session_id: str
    agent_id: int

@app.post("/support-requests/generate-summary", dependencies=[Depends(verify_api_key)])
async def generate_support_summary(payload: SupportSummaryRequest, db: AsyncSession = Depends(get_db)):
    """Gera um resumo e motivo de suporte on-demand via IA para uma sessão."""
    try:
        from agent import generate_handoff_summary
        history = await get_chat_history(db, 30, payload.session_id)
        if not history:
            return {"summary": "Sem histórico disponível.", "reason": "N/A"}
        summary = await generate_handoff_summary(history)
        return {"summary": summary, "reason": "Análise gerada via IA"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# =============================================
# --- ACESSO PÚBLICO (READ-ONLY) ---
# =============================================

@app.get("/public/support/{token}")
async def public_support_requests(token: str, db: AsyncSession = Depends(get_db)):
    """Acesso público readonly para pedidos de suporte."""
    # Valida token via variável global
    var_result = await db.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == "PUBLIC_ACCESS_TOKEN_SUPPORT"))
    var = var_result.scalar_one_or_none()
    
    if not var or var.value != token:
        raise HTTPException(status_code=403, detail="Token de acesso público inválido ou expirado.")
    
    result = await db.execute(
        select(SupportRequestModel, AgentConfigModel.name.label("agent_name"))
        .join(AgentConfigModel, SupportRequestModel.agent_id == AgentConfigModel.id, isouter=True)
        .where(SupportRequestModel.status == "OPEN")
        .order_by(SupportRequestModel.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": r.SupportRequestModel.id,
            "agent_id": r.SupportRequestModel.agent_id,
            "agent_name": r.agent_name or "Agente Excluído",
            "session_id": r.SupportRequestModel.session_id,
            "user_name": r.SupportRequestModel.user_name,
            "user_email": r.SupportRequestModel.user_email,
            "status": r.SupportRequestModel.status,
            "summary": r.SupportRequestModel.summary,
            "reason": r.SupportRequestModel.reason,
            "extracted_data": r.SupportRequestModel.extracted_data or {},
            "created_at": r.SupportRequestModel.created_at.isoformat() if r.SupportRequestModel.created_at else None,
        }
        for r in rows
    ]

@app.get("/public/unanswered/{token}")
async def public_unanswered_questions(token: str, db: AsyncSession = Depends(get_db)):
    """Acesso público readonly para perguntas não respondidas."""
    var_result = await db.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == "PUBLIC_ACCESS_TOKEN_UNANSWERED"))
    var = var_result.scalar_one_or_none()
    
    if not var or var.value != token:
        raise HTTPException(status_code=403, detail="Token de acesso público inválido ou expirado.")
    
    stmt = select(UnansweredQuestionModel).where(
        UnansweredQuestionModel.status == "PENDENTE"
    ).order_by(UnansweredQuestionModel.created_at.desc())
    
    result = await db.execute(stmt)
    questions = result.scalars().all()
    
    return {
        "success": True, 
        "items": [{
            "id": q.id,
            "agent_id": q.agent_id,
            "session_id": q.session_id,
            "question": q.question,
            "context": q.context,
            "status": q.status,
            "created_at": q.created_at.isoformat() if q.created_at else None
        } for q in questions]
    }

@app.get("/settings/public-tokens")
async def get_public_tokens(db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Retorna os tokens públicos atuais ou gera novos se não existirem."""
    keys = ["PUBLIC_ACCESS_TOKEN_SUPPORT", "PUBLIC_ACCESS_TOKEN_UNANSWERED"]
    results = {}
    import uuid
    
    for key in keys:
        res = await db.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == key))
        var = res.scalar_one_or_none()
        if not var:
            # Gerar novo token se não existir
            new_token = str(uuid.uuid4())
            var = GlobalContextVariableModel(key=key, value=new_token, type="string", description=f"Token de acesso público para {key.split('_')[-1]}")
            db.add(var)
            results[key] = new_token
        else:
            results[key] = var.value
    
    await db.commit()
    return results

@app.post("/settings/public-tokens/rotate")
async def rotate_public_token(target: str, db: AsyncSession = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Rotaciona um token público específico."""
    key = f"PUBLIC_ACCESS_TOKEN_{target.upper()}"
    import uuid
    
    res = await db.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == key))
    var = res.scalar_one_or_none()
    new_token = str(uuid.uuid4())
    
    if not var:
        var = GlobalContextVariableModel(key=key, value=new_token, type="string", description=f"Token de acesso público para {target.upper()}")
        db.add(var)
    else:
        var.value = new_token
        
    await db.commit()
    return {"key": key, "new_token": new_token}
# =============================================
# --- ACESSO PÚBLICO COM AÇÕES ---
# =============================================

@app.get("/public/knowledge-bases/{token}")
async def public_get_knowledge_bases(token: str, db: AsyncSession = Depends(get_db)):
    """Lista bases de conhecimento para a interface pública responder dúvidas."""
    var_result = await db.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == "PUBLIC_ACCESS_TOKEN_UNANSWERED"))
    var = var_result.scalar_one_or_none()
    if not var or var.value != token:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    result = await db.execute(select(KnowledgeBaseModel).order_by(KnowledgeBaseModel.name.asc()))
    kbs = result.scalars().all()
    return [{"id": k.id, "name": k.name} for k in kbs]

@app.post("/public/unanswered/{token}/{question_id}/answer")
async def public_answer_unanswered_question(
    token: str,
    question_id: int, 
    req: AnswerUnansweredRequest, 
    db: AsyncSession = Depends(get_db)
):
    """Responde dúvida via interface pública."""
    var_result = await db.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == "PUBLIC_ACCESS_TOKEN_UNANSWERED"))
    var = var_result.scalar_one_or_none()
    if not var or var.value != token:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    q_result = await db.execute(select(UnansweredQuestionModel).where(UnansweredQuestionModel.id == question_id))
    question_record = q_result.scalar_one_or_none()
    if not question_record:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada.")
        
    kb_result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == req.knowledge_base_id))
    if not kb_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Base de Conhecimento não encontrada.")
        
    final_question = req.question if req.question else question_record.question
    emb, _ = await get_embedding(final_question)
    
    new_item = KnowledgeItemModel(
        knowledge_base_id=req.knowledge_base_id,
        question=final_question,
        answer=req.answer,
        category="Public Inbox",
        embedding=emb
    )
    db.add(new_item)
    question_record.status = "RESPONDIDA"
    question_record.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True, "message": "Pergunta respondida com sucesso."}

@app.post("/public/unanswered/{token}/{question_id}/discard")
async def public_discard_unanswered_question(
    token: str,
    question_id: int, 
    db: AsyncSession = Depends(get_db)
):
    """Descarta dúvida via interface pública."""
    var_result = await db.execute(select(GlobalContextVariableModel).where(GlobalContextVariableModel.key == "PUBLIC_ACCESS_TOKEN_UNANSWERED"))
    var = var_result.scalar_one_or_none()
    if not var or var.value != token:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    q_result = await db.execute(select(UnansweredQuestionModel).where(UnansweredQuestionModel.id == question_id))
    question_record = q_result.scalar_one_or_none()
    if not question_record:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada.")
            
    question_record.status = "DESCARTADA"
    question_record.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True, "message": "Pergunta descartada com sucesso."}
