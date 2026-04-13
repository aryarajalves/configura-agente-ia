from fastapi import APIRouter, Depends
from src.models.schemas import SuccessResponse
from src.api.auth import get_superadmin

router = APIRouter()

@router.get("", response_model=SuccessResponse)
async def list_models(admin: dict = Depends(get_superadmin)):
    """Return list of available AI models for agent configuration."""
    models = [
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI"},
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "OpenAI"},
        {"id": "o1-mini", "name": "o1 Mini", "provider": "OpenAI"},
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "provider": "Google"},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "Google"},
        {"id": "claude-3-5-sonnet-latest", "name": "Claude 3.5 Sonnet", "provider": "Anthropic"},
    ]
    return SuccessResponse(data=models)
