from fastapi import FastAPI, Response, APIRouter
from src.models.schemas import SuccessResponse
from src.api.v1 import agents, chat, audit, stress_tests, inbox, finance, system_settings, metrics, auth, knowledge_bases, dashboard
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

# Core routers
app.include_router(agents.router, prefix="/v1/agents", tags=["Agents"])
app.include_router(chat.router, prefix="/v1/chat", tags=["Chat"])
app.include_router(audit.router, prefix="/v1/audit", tags=["Audit"])
app.include_router(stress_tests.router, prefix="/v1/stress-tests", tags=["Performance"])
app.include_router(inbox.router, prefix="/v1/inbox", tags=["Inbox"])
app.include_router(finance.router, prefix="/v1/finance", tags=["Finance"])
app.include_router(system_settings.router, prefix="/v1/system/settings", tags=["System Settings"])
app.include_router(metrics.router, prefix="/v1/system/metrics", tags=["System Metrics"])

# Auth + onboarding
app.include_router(auth.router, prefix="/v1", tags=["Auth"])

# Knowledge Bases (formerly Skills) - primary route
app.include_router(knowledge_bases.router, prefix="/v1/knowledge-bases", tags=["Knowledge Bases"])

# Legacy skill routes kept for backward compatibility
from src.api.v1 import skills
app.include_router(skills.router, prefix="/v1/skills", tags=["Skills (Legacy)"])

# Dashboard stats
app.include_router(dashboard.router, prefix="/v1/dashboard", tags=["Dashboard"])

from src.api.v1 import models, tools

# /v1/models
app.include_router(models.router, prefix="/v1/models", tags=["Models"])

# /v1/tools
app.include_router(tools.router, prefix="/v1/tools", tags=["Tools"])

# /v1/fine-tuning/models and jobs
from src.api.v1 import fine_tuning
app.include_router(fine_tuning.router, prefix="/v1/fine-tuning", tags=["Fine-Tuning"])

# /v1/integrations stubs
integrations_router = APIRouter()

@integrations_router.get("/google/status")
async def google_integration_status():
    """Return Google integration status."""
    return SuccessResponse(data={"connected": False, "provider": "google"})

app.include_router(integrations_router, prefix="/v1/integrations", tags=["Integrations"])

# /v1/users (admin listing)
from src.api.v1 import users as users_v1
app.include_router(users_v1.router, prefix="/v1/users", tags=["Users"])

# /v1/financial/report alias
from src.api.v1 import financial_report
app.include_router(financial_report.router, prefix="/v1/financial", tags=["Financial Report"])


@app.get("/")
async def root():
    return {"message": "Motor FluxAI Core Engine is running"}
