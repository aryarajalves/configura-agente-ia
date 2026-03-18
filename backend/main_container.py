from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Security, Request, Response
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from typing import Any, List, Dict
from config_store import AgentConfig, KnowledgeBase, KnowledgeItem, MODEL_INFO, USD_TO_BRL
from agent import process_message, summarize_history, extract_questions_from_history, get_openai_client
from rag_service import calculate_coverage, get_embedding
from database import init_db, get_db
from models import InteractionLog, AgentConfigModel, ToolModel, KnowledgeBaseModel, KnowledgeItemModel, SessionSummary, PromptDraftModel, FeedbackLog, GlobalContextVariableModel
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import json
import os
import re
import time
from smart_importer import extract_text_from_pdf, chunk_text, generate_qa_from_text
import logging
import asyncio
from router_import import router as import_router

# Configuração de Logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from prompt_lab import router as prompt_lab_router
from session_analysis import router as analysis_router
from google_calendar import GoogleCalendarService
from models import GoogleTokensModel

# --- PII FILTER ---
_PII_PATTERNS = [
    # Email
    (re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'), '[EMAIL OCULTO]'),
    # CPF: 000.000.000-00 ou 00000000000
    (re.compile(r'\b\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[-\s]?\d{2}\b'), '[CPF OCULTO]'),
    # CNPJ: 00.000.000/0000-00
    (re.compile(r'\b\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}\b'), '[CNPJ OCULTO]'),
    # Telefone BR: +55 11 99999-9999 / (11) 9999-9999 / 11999999999
    (re.compile(r'(\+55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[\s\-]?\d{4}\b'), '[TELEFONE OCULTO]'),
    # Cartão de crédito: 16 dígitos agrupados
    (re.compile(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b'), '[CARTÃO OCULTO]'),
]

def apply_pii_filter(text: str) -> tuple[str, list[str]]:
    """Mascara dados sensíveis na resposta. Retorna (texto_filtrado, lista_de_tipos_encontrados)."""
    found = []
    for pattern, replacement in _PII_PATTERNS:
        if pattern.search(text):
            found.append(replacement)
            text = pattern.sub(replacement, text)
    return text, found

# --- API KEY AUTHENTICATION ---
_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(_API_KEY_HEADER)):
    """Dependência que valida a API Key enviada no header X-API-Key."""
    logger.info("--- DEBUG AUTH START ---")
    expected = os.getenv("AGENT_API_KEY", "")
    logger.info(f"Esperada: '{expected[:5]}...'")
    logger.info(f"Recebida: '{api_key[:5] if api_key else 'None'}...'")
    if not expected:
        logger.info("Auth: Nenhuma chave esperada configurada. Pulando.")
        return
    if api_key != expected:
        logger.warning(f"DEBUG AUTH: FALHA! Recebido '{api_key}', Esperado '{expected}'")
        raise HTTPException(
            status_code=403,
            detail="API Key inválida ou ausente. Envie o header X-API-Key correto."
        )
    logger.info("--- DEBUG AUTH SUCCESS ---")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="AI Agent API", lifespan=lifespan)

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/login")
async def login(req: LoginRequest):
    # Uso de dotenv_values para ler o arquivo diretamente sem cache do OS
    from dotenv import dotenv_values
    import os
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    
    # Se o arquivo não existir (ex: Docker), env_vars fica vazio e usamos os.getenv fallback
    env_vars = {}
    if os.path.exists(env_path):
        env_vars = dotenv_values(env_path)

    admin_email = env_vars.get("ADMIN_EMAIL") or os.getenv("ADMIN_EMAIL") or "aryarajmarketing@gmail.com"
    admin_password = env_vars.get("ADMIN_PASSWORD") or os.getenv("ADMIN_PASSWORD") or "aryaraj123"
    
    if req.email == admin_email and str(req.password) == str(admin_password):
        return {"success": True, "token": "admin-session-token"}
    
    raise HTTPException(status_code=401, detail="Email ou senha incorretos")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"ERRO GLOBAL CAPTURADO: {str(exc)}", exc_info=True)
    return Response(
        content=json.dumps({"detail": "Erro interno no servidor", "error": str(exc)}),
        status_code=500,
        media_type="application/json"
    )

# Configuração de CORS (Sistema oficial do FastAPI)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
async def ping():
    return {"status": "ok", "message": "Backend is reachable"}

app.include_router(import_router)
app.include_router(prompt_lab_router)
app.include_router(analysis_router)

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

@app.get("/models")
async def list_models():
    from config_store import discover_models
    discovered = discover_models()
    return {
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
@app.get("/integrations/google/auth-url")
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
        
        # Redireciona de volta para a tela de integrações (global ou do agente)
        # Em produção, deve redirecionar para a URL do seu Frontend
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5300").rstrip('/')
        return RedirectResponse(url=f"{frontend_url}{redirect_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/integrations/google/status")
async def get_google_status(agent_id: int | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GoogleTokensModel).where(GoogleTokensModel.agent_id == agent_id))
    token = result.scalars().first()
    return {"connected": token is not None}

# --- KNOWLEDGE BASE ENDPOINTS ---
@app.get("/knowledge-bases", response_model=List[KnowledgeBase])
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).options(selectinload(KnowledgeBaseModel.items)))
    return result.scalars().all()

@app.post("/knowledge-bases", response_model=KnowledgeBase)
async def create_knowledge_base(kb: KnowledgeBase, db: AsyncSession = Depends(get_db)):
    # Logging for debug
    with open("knowledge_base_debug.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()}: CREATE KB - Received type: '{kb.kb_type}', Name: '{kb.name}'\n")
    
    print(f"DEBUG: creating KB with type '{kb.kb_type}' and name '{kb.name}'")
    # Check for duplicate name
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.name == kb.name))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Já existe uma base de conhecimento com este nome.")

    db_kb = KnowledgeBaseModel(
        name=kb.name, 
        description=kb.description, 
        kb_type=kb.kb_type
    )
    # Force set to ensure SQLAlchemy doesn't use default "qa"
    db_kb.kb_type = str(kb.kb_type)
    
    db.add(db_kb)
    await db.commit()
    await db.refresh(db_kb)
    
    with open("knowledge_base_debug.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()}: CREATE KB - Saved ID {db_kb.id} as type '{db_kb.kb_type}'\n")
        
    return db_kb

@app.get("/knowledge-bases/{kb_id}", response_model=KnowledgeBase)
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

@app.put("/knowledge-bases/{kb_id}", response_model=KnowledgeBase)
async def update_knowledge_base(kb_id: int, kb: KnowledgeBase, db: AsyncSession = Depends(get_db)):
    with open("knowledge_base_debug.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()}: UPDATE KB {kb_id} - Received type: '{kb.kb_type}'\n")
        
    print(f"DEBUG: updating KB {kb_id} to type '{kb.kb_type}'")
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
    db_kb.kb_type = str(kb.kb_type) # Force update
    
    await db.commit()
    await db.refresh(db_kb)
    
    with open("knowledge_base_debug.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()}: UPDATE KB {kb_id} - Saved type: '{db_kb.kb_type}'\n")
        
    return db_kb

@app.delete("/knowledge-bases/{kb_id}")
async def delete_knowledge_base(kb_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb = result.scalars().first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")
    await db.delete(kb)
    await db.commit()
    return {"message": "Knowledge Base deleted"}

# --- KNOWLEDGE ITEM ENDPOINTS ---
@app.post("/knowledge-bases/{kb_id}/items", response_model=KnowledgeItem)
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

@app.delete("/knowledge-items/{item_id}")
async def delete_knowledge_item(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeItemModel).where(KnowledgeItemModel.id == item_id))
    item = result.scalars().first()
    if item:
        await db.delete(item)
        await db.commit()
    return {"message": "Item deleted"}

@app.put("/knowledge-items/{item_id}", response_model=KnowledgeItem)
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

@app.post("/knowledge-bases/{kb_id}/items/bulk")
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

@app.delete("/knowledge-bases/{kb_id}/items/batch-delete")
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

@app.post("/knowledge-bases/{kb_id}/upload")
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
            metadata_val="",
            category="Upload"
        )
        db.add(db_item)
    
    await db.commit()
    return {"message": f"Extraído {len(lines)} itens do arquivo {file.filename}"}

@app.post("/knowledge-bases/analyze-file")
async def analyze_kb_file(file: UploadFile = File(...)):
    import pandas as pd
    import io
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), nrows=5)
        elif filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content), nrows=5)
        elif filename.endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                return {"page_count": len(pdf.pages), "is_pdf": True}
        else:
            return {"error": "Formato não suportado para análise. Use CSV, Excel ou PDF."}
            
        return {"columns": df.columns.tolist(), "preview": df.head(3).to_dict(orient="records"), "is_pdf": False}
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge-bases/{kb_id}/import-mapped")
async def import_mapped_file(
    kb_id: int, 
    question_col: str = Form(...),
    answer_col: str | None = Form(None),
    answer_mapping_json: str | None = Form(None),
    category_col: str | None = Form(None),
    fixed_category: str | None = Form(None),
    metadata_col: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    import pandas as pd
    import io
    import json
    content = await file.read()
    filename = file.filename.lower()
    
    try:
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

        mapped_answers = []
        if answer_mapping_json:
            mapped_answers = json.loads(answer_mapping_json)

        for _, row in df.iterrows():
            q = str(row.get(question_col, "")).strip()
            
            if mapped_answers:
                content_parts = []
                for m in mapped_answers:
                    col = m.get('column')
                    label = m.get('label', '')
                    val = str(row.get(col, "")).strip()
                    if val and val != "nan":
                        # Se já terminar com ": " ou espaço, não adiciona mais espaço. Evita "label: : valor"
                        content_parts.append(f"{label}{val}")
                a = ", ".join(content_parts)
            else:
                a = str(row.get(answer_col, "")).strip() if answer_col else ""

            if not a or a == "nan": continue
            if not q or q == "nan": 
                q = a[:100] + "..." # Fallback se não tiver question_col válida
            
            cat = "Geral"
            if fixed_category:
                cat = fixed_category
            elif category_col and category_col in row:
                cat = str(row.get(category_col, "Geral")).strip()
            
            if cat == "nan": cat = "Geral"

            meta_val = ""
            if metadata_col and metadata_col in row:
                meta_val = str(row.get(metadata_col, "")).strip()
            if meta_val == "nan": meta_val = ""

            q_key = q.lower()
            if q_key in existing_map:
                # Update existing
                db_item = existing_map[q_key]
                db_item.answer = a
                db_item.category = cat
                updated_count += 1
            else:
                # Create new
                db_item = KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question=q,
                    answer=a,
                    metadata_val=meta_val,
                    category=cat
                )
                db.add(db_item)
                # Add to map to avoid duplicates within the same file too
                existing_map[q_key] = db_item
                count += 1
            
        await db.commit()
        msg = f"Importação concluída: {count} novos itens"
        if updated_count > 0:
            msg += f" e {updated_count} atualizados"
        return {"message": msg + "."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/knowledge-bases/{kb_id}/import-products")
async def import_products_file(
    kb_id: int, 
    mapping_json: str = Form(...), # List of {column: str, label: str}
    primary_col: str = Form(...),  # Column to use as 'question'
    category_col: str | None = Form(None),
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

        # Fetch existing
        existing_result = await db.execute(
            select(KnowledgeItemModel).where(KnowledgeItemModel.knowledge_base_id == kb_id)
        )
        existing_map = {item.question.strip().lower(): item for item in existing_result.scalars().all()}

        count = 0
        updated_count = 0
        for _, row in df.iterrows():
            primary_val = str(row.get(primary_col, "")).strip()
            if not primary_val or primary_val == "nan": continue
            
            # Construct formatted content
            content_parts = []
            meta_dict = {"is_product": True, "primary_key": primary_col}
            
            for m in mappings:
                col = m.get('column')
                label = m.get('label', '')
                val = str(row.get(col, "")).strip()
                if val and val != "nan":
                    # User requested separation by comma in the description, 
                    # but also gave a multiline example. Let's do comma for same-line fields 
                    # or just build a nice string.
                    content_parts.append(f"{label}{val}")
                    meta_dict[col] = val
            
            # AI Answer construction (Join by comma or newline)
            # User specifically said "separar as informações da linha por virgula"
            formatted_answer = ", ".join(content_parts)
            
            cat = "Produtos"
            if category_col and category_col in row:
                cat = str(row.get(category_col, "Produtos")).strip()
            if cat == "nan": cat = "Produtos"

            q_key = primary_val.lower()
            emb_text = f"{primary_val} {formatted_answer}"
            emb, _ = await get_embedding(emb_text)

            if q_key in existing_map:
                db_item = existing_map[q_key]
                db_item.answer = formatted_answer
                db_item.category = cat
                db_item.source_metadata = json.dumps(meta_dict, ensure_ascii=False)
                db_item.embedding = emb
                updated_count += 1
            else:
                db_item = KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question=primary_val,
                    answer=formatted_answer,
                    metadata_val=json.dumps(meta_dict, ensure_ascii=False),
                    category=cat,
                    source_metadata=json.dumps(meta_dict, ensure_ascii=False),
                    embedding=emb
                )
                db.add(db_item)
                existing_map[q_key] = db_item
                count += 1
            
        await db.commit()
        msg = f"Importação de produtos concluída: {count} novos produtos"
        if updated_count > 0:
            msg += f" e {updated_count} atualizados"
        return {"message": msg + "."}
    except Exception as e:
        logger.error(f"Erro na importação de produtos: {e}", exc_info=True)
        return {"error": str(e)}

@app.post("/knowledge-bases/{kb_id}/scrape")
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

@app.post("/knowledge-bases/{kb_id}/coverage")
async def check_coverage(kb_id: int, payload: CoverageCheckRequest, db: AsyncSession = Depends(get_db)):
    results = await calculate_coverage(db, payload.questions, kb_id)
    return {"results": results}

# --- AGENT MANAGEMENT UPDATED ---
@app.get("/agents", response_model=List[AgentConfig])
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
            handoff_enabled=a.handoff_enabled
        ) for a in db_agents
    ]

@app.post("/agents", response_model=AgentConfig)
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
        handoff_enabled=config.handoff_enabled
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
        router_complex_model=db_config.router_complex_model,
        inbox_capture_enabled=db_config.inbox_capture_enabled
    )

@app.get("/agents/models", response_model=List[str])
async def list_available_models():
    return list(MODEL_INFO.keys())

@app.get("/agents/{agent_id}", response_model=AgentConfig)
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
        router_complex_model=db_config.router_complex_model,
        inbox_capture_enabled=db_config.inbox_capture_enabled,
        handoff_enabled=db_config.handoff_enabled
    )

@app.put("/agents/{agent_id}", response_model=AgentConfig)
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
    db_config.inbox_capture_enabled = config.inbox_capture_enabled
    db_config.handoff_enabled = config.handoff_enabled
    db_config.response_translation_enabled = config.response_translation_enabled
    db_config.response_translation_fallback_lang = config.response_translation_fallback_lang or "portuguese"

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
        ui_primary_color=db_config.ui_primary_color,
        ui_header_color=db_config.ui_header_color,
        ui_chat_title=db_config.ui_chat_title,
        ui_welcome_message=db_config.ui_welcome_message,
        router_enabled=db_config.router_enabled,
        router_simple_model=db_config.router_simple_model,
        router_complex_model=db_config.router_complex_model,
        inbox_capture_enabled=db_config.inbox_capture_enabled
    )

@app.get("/agents/{agent_id}/drafts", response_model=List[PromptDraft])
async def list_agent_drafts(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptDraftModel).where(PromptDraftModel.agent_id == agent_id).order_by(PromptDraftModel.created_at.desc()))
    return result.scalars().all()

@app.post("/agents/{agent_id}/toggle", response_model=AgentConfig)
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
        router_complex_model=db_config.router_complex_model
    )

@app.post("/agents/{agent_id}/duplicate", response_model=AgentConfig)
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
    )

@app.post("/agents/{agent_id}/drafts", response_model=PromptDraft)
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

@app.delete("/drafts/{draft_id}")
async def delete_draft(draft_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptDraftModel).where(PromptDraftModel.id == draft_id))
    draft = result.scalars().first()
    if draft:
        await db.delete(draft)
        await db.commit()
    return {"message": "Draft deleted"}
    
@app.put("/drafts/{draft_id}", response_model=PromptDraft)
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

@app.delete("/agents/{agent_id}")
async def delete_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == agent_id))
    agent = result.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    await db.delete(agent)
    await db.commit()
    return {"message": "Agent deleted"}

@app.get("/tools", response_model=List[ToolResponse])
async def list_tools(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolModel).order_by(ToolModel.id))
    return result.scalars().all()

@app.post("/integrations/google/provision-tools")
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
                    "fim": {"type": "string", "description": "Data/hora de fim do período a listar no formato ISO 8601 (ex: 2024-10-27T23:59:59-03:00). Fundamental para buscar eventos passados — defina como o fim do período desejado."}
                },
                "required": []
            })
        },
        {
            "name": "google_calendar_atualizar_evento",
            "description": "Atualiza um evento existente no Google Calendar. Use quando o usuário quiser editar, alterar, reagendar um compromisso, adicionar/remover convidados ou mudar a cor. É necessário ter o ID do evento (obtido ao criar ou listar eventos).",
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
            "description": "Remove um evento do Google Calendar. Use quando o usuário pedir para cancelar ou excluir um compromisso. É necessário ter o ID do evento.",
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
            "name": "internal_date_calculator",
            "description": "Calcula datas relativas ou descrições temporais (ex: 'sexta-feira que vem', 'daqui a 3 meses', 'ontem'). Retorna a data exata formatada.",
            "parameters_schema": json.dumps({
                "type": "object",
                "properties": {
                    "date_description": {"type": "string", "description": "Descrição da data (ex: 'próxima segunda', '15 dias atrás')"}
                },
                "required": ["date_description"]
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


@app.post("/tools", response_model=ToolResponse)
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

@app.delete("/tools/{tool_id}")
async def delete_tool(tool_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolModel).where(ToolModel.id == tool_id))
    tool = result.scalars().first()
    if tool:
        await db.delete(tool)
        await db.commit()
    return {"status": "deleted"}

@app.put("/tools/{tool_id}", response_model=ToolResponse)
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

@app.post("/sessions/delete")
async def delete_sessions(request: DeleteSessionsRequest, db: AsyncSession = Depends(get_db)):
    # Deletar logs e resumos associados
    if not request.session_ids:
        return {"message": "Nenhuma sessão selecionada"}
        
    await db.execute(delete(SessionSummary).where(SessionSummary.session_id.in_(request.session_ids)))
    await db.execute(delete(InteractionLog).where(InteractionLog.session_id.in_(request.session_ids)))
    await db.commit()
    return {"message": f"{len(request.session_ids)} sessões deletadas com sucesso"}


# ... (imports)

async def get_chat_history(db: AsyncSession, limit: int, session_id: str | None = None):
    if limit <= 0:
        return []
    
    # Busca as últimas 'limit' interações ordenadas pela mais recente
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
            "content": f"🚨 ATENÇÃO: Você está assumindo este atendimento agora através de uma TRANSFERÊNCIA.\n"
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
        handoff_enabled=db_config.handoff_enabled
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
    
    content = result["content"]
    
    # --- MEMORY UPDATE (Extract new facts) ---
    if session_id and content:
        try:
            from agent import update_user_memory
            await update_user_memory(db, session_id, request.message, content)
        except Exception as e:
            print(f"⚠️ Erro ao disparar extrator de memória: {e}")
    usage = result.get("usage")
    tool_calls = result.get("tool_calls")
    
    input_tokens = 0
    output_tokens = 0
    cost_usd = 0.0
    cost_brl = 0.0
    model = result.get("model", "unknown")

    if usage:
        input_tokens = usage.prompt_tokens
        output_tokens = usage.completion_tokens
        cost_usd = calculate_cost(model, input_tokens, output_tokens)
        cost_brl = cost_usd * USD_TO_BRL

    # --- RESPONSE TRANSLATION ---
    trans_enabled = getattr(db_config, 'response_translation_enabled', False)
    if content and trans_enabled:
        try:
            from rag_service import detect_message_language, translate_to_language
            trans_model = db_config.router_simple_model if db_config.router_simple_model else "gpt-4o-mini"
            fallback_lang = getattr(db_config, 'response_translation_fallback_lang', 'pt-br') or 'pt-br'
            detected_lang, u_detect = await detect_message_language(request.message, model=trans_model)
            used_fallback = not detected_lang
            target_lang = detected_lang if detected_lang else fallback_lang
            translated, u_trans = await translate_to_language(content, target_lang, model=trans_model)
            if translated:
                content = translated
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

    # --- PII FILTER ---
    if content and getattr(db_config, 'security_pii_filter', False):
        content, pii_found = apply_pii_filter(content)
        if pii_found:
            print(f"🔒 PII Filter: mascarados {pii_found}")
            if result.get("debug") is None:
                result["debug"] = {}
            result["debug"]["pii_filter"] = {"masked": pii_found}

    # Log to DB if session_id is present (Safely)
    if request.session_id:
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
                debug_info=json.dumps(result.get("debug") or {}, default=str)
            )
            db.add(log_entry)
            await db.commit()
        except Exception as log_error:
            logger.error(f"⚠️ Erro ao salvar log de interação: {log_error}")
            await db.rollback()

        # Print info to terminal
        print("\n" + "="*50)
        print("📊 RELATÓRIO DE EXECUÇÃO (RAG ATIVO)")
        print("="*50)
        print(f"🤖 Modelo Usado: {model}")
        print(f"📥 Tokens de Entrada: {input_tokens}")
        print(f"📤 Tokens de Saída:  {output_tokens}")
        print("-" * 20)
        print(f"💰 Custo (USD): ${cost_usd:.6f}")
        print(f"💸 Custo (BRL): R${cost_brl:.6f}")
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
        "error": result.get("error", False)
    }

class SessionPreview(BaseModel):
    session_id: str
    agent_id: int
    agent_name: str | None
    start_time: datetime
    last_interaction: datetime
    message_count: int
    summary: str | None
    total_cost: float

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
    persona_prompt: str
    history: List[Dict[str, str]]

@app.post("/tester/provoke")
async def provoke_agent(request: TesterProvocationRequest):
    client = get_openai_client()
    if not client:
        raise HTTPException(status_code=500, detail="OpenAI Client not configured")
    
    # Prepara o histórico para o Tester
    tester_messages = [
        {"role": "system", "content": f"{request.persona_prompt}\nVocê é um cliente conversando com um agente. Gere apenas a sua próxima fala de provocação baseada no histórico."}
    ]
    
    # Injetar histórico (simplificado)
    for msg in request.history[-10:]: # Pega as últimas 10 para contexto
        role = "assistant" if msg["role"] == "user" else "user" # Inverte papéis pq o Tester é o cliente
        tester_messages.append({"role": role, "content": msg["content"]})
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=tester_messages,
            temperature=0.8,
            max_tokens=200
        )
        provocation = response.choices[0].message.content.strip()
        return {"provocation": provocation}
    except Exception as e:
        logger.error(f"Erro ao gerar provocação: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions", response_model=List[SessionPreview])
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
            summaries[s.session_id] = s.summary_text
            
    # Get Agent Names
    agent_ids = list(set([row.agent_id for row in rows]))
    agent_names = {}
    if agent_ids:
        ag_result = await db.execute(select(AgentConfigModel.id, AgentConfigModel.name).where(AgentConfigModel.id.in_(agent_ids)))
        for a_id, a_name in ag_result.all():
            agent_names[a_id] = a_name

    sessions = []
    for row in rows:
        sessions.append(SessionPreview(
            session_id=row.session_id,
            agent_id=row.agent_id,
            agent_name=agent_names.get(row.agent_id, "Unknown"),
            start_time=row.start_time.replace(tzinfo=timezone.utc) if row.start_time else row.start_time,
            last_interaction=row.last_interaction.replace(tzinfo=timezone.utc) if row.last_interaction else row.last_interaction,
            message_count=row.message_count,
            summary=summaries.get(row.session_id),
            total_cost=row.total_cost or 0.0
        ))
        
    return sessions

@app.get("/sessions/{session_id}/messages", response_model=List[SessionMessage])
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

@app.get("/agents/{agent_id}/history")
async def get_agent_history(agent_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InteractionLog)
        .where(InteractionLog.agent_id == agent_id)
        .order_by(InteractionLog.timestamp.desc())
        .limit(100)
    )
    logs = result.scalars().all()
    return logs

@app.get("/sessions/{session_id}/summarize")
async def summarize_session(session_id: str, db: AsyncSession = Depends(get_db)):
    # 1. Verificar se já existe um resumo salvo
    existing_result = await db.execute(select(SessionSummary).where(SessionSummary.session_id == session_id))
    existing_summary = existing_result.scalars().first()
    
    if existing_summary:
        print(f"📄 Resumo recuperado do banco para a sessão: {session_id}")
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

@app.get("/sessions/{session_id}/questions")
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

@app.get("/global-variables", response_model=List[GlobalContextVariable])
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

@app.post("/global-variables", response_model=GlobalContextVariable)
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
        raise HTTPException(status_code=400, detail="Key already exists or invalid data")

@app.put("/global-variables/{var_id}", response_model=GlobalContextVariable)
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

@app.delete("/global-variables/{var_id}")
async def delete_global_variable(var_id: int, db: AsyncSession = Depends(get_db)):
    db_var = await db.get(GlobalContextVariableModel, var_id)
    if not db_var:
        raise HTTPException(status_code=404, detail="Variable not found")
    if db_var.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default variables")
    
    await db.delete(db_var)
    await db.commit()
    return {"status": "success"}

@app.get("/dashboard/stats", response_model=DashboardStats)
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

@app.delete("/sessions")
async def delete_sessions(request: DeleteSessionsRequest, db: AsyncSession = Depends(get_db)):
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
    return {"message": f"{len(request.session_ids)} sessões deletadas"}

@app.get("/financial/report", response_model=FinancialReport)
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
        query.group_by(date_field, InteractionLog.agent_id, AgentConfigModel.name)
        .order_by(date_field.desc(), AgentConfigModel.name)
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
            "agent_name": row.agent_name or "Agente Excluído",
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
# 🏭 FINE-TUNING PIPELINE — Endpoints de Feedback e Treinamento
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

@app.post("/feedback", response_model=FeedbackResponse)
async def create_feedback(payload: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    """Salva um registro de feedback (👍 ou 👎) com a correção opcional."""
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

@app.get("/feedback")
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

@app.delete("/feedback/{feedback_id}")
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

@app.patch("/feedback/{feedback_id}")
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

@app.get("/feedback/export/{agent_id}")
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
        raise HTTPException(status_code=404, detail="Nenhum exemplo de treinamento disponível. Adicione correções primeiro.")

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

@app.post("/fine-tuning/start")
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

@app.get("/fine-tuning/jobs")
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

@app.get("/fine-tuning/jobs/{job_id}")
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

@app.post("/fine-tuning/cleanup-checkpoints")
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


@app.get("/fine-tuning/models")
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


@app.delete("/fine-tuning/models/{model_id:path}")
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
