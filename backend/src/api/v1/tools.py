from fastapi import APIRouter, Depends
from src.models.schemas import SuccessResponse
from src.api.auth import get_superadmin

router = APIRouter()

@router.get("", response_model=SuccessResponse)
async def list_tools(admin: dict = Depends(get_superadmin)):
    """Return list of available tools for agent development."""
    tools = [
        {"id": "web_search", "name": "Web Search (Google/Brave)", "description": "Permite ao agente buscar informações em tempo real na internet."},
        {"id": "python_interpreter", "name": "Interpretador Python", "description": "Executa código Python para cálculos complexos e visualização de dados."},
        {"id": "calendar_sync", "name": "Sincronização de Agenda", "description": "Lê e escreve eventos no Google Calendar ou Outlook."},
        {"id": "whatsapp_outbound", "name": "WhatsApp Proativo", "description": "Envia mensagens iniciadas pelo agente via API oficial."},
        {"id": "financial_calculator", "name": "Calculadora Financeira", "description": "Cálculos de ROI, Amortização e Juros Compostos."},
    ]
    return SuccessResponse(data=tools)
