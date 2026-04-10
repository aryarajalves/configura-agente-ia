from fastapi import FastAPI
from src.api.v1 import agents, chat, audit, stress_tests, inbox, finance, system_settings, metrics, auth, skills, dashboard
from src.api.middleware import error_handling_middleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(
    title="Motor FluxAI API",
    description="Core Engine for Agent Configuration and Orchestration",
    version="1.0.0",
)

app.add_middleware(BaseHTTPMiddleware, dispatch=error_handling_middleware)

# Configuração de CORS (Deve vir por último para envolver todas as respostas, inclusive erros)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents.router, prefix="/v1/agents", tags=["Agents"])
app.include_router(chat.router, prefix="/v1/chat", tags=["Chat"])
app.include_router(audit.router, prefix="/v1/audit", tags=["Audit"])
app.include_router(stress_tests.router, prefix="/v1/stress-tests", tags=["Performance"])
app.include_router(inbox.router, prefix="/v1/inbox", tags=["Inbox"])
app.include_router(finance.router, prefix="/v1/finance", tags=["Finance"])
app.include_router(system_settings.router, prefix="/v1/system/settings", tags=["System Settings"])
app.include_router(metrics.router, prefix="/v1/system/metrics", tags=["System Metrics"])

app.include_router(auth.router, prefix="/v1", tags=["Auth"])
app.include_router(skills.router, prefix="/v1/skills", tags=["Skills"])
app.include_router(dashboard.router, prefix="/v1/dashboard", tags=["Dashboard"])

@app.get("/")
async def root():
    return {"message": "Motor FluxAI Core Engine is running"}
