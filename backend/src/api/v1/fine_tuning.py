from fastapi import APIRouter
from src.models.schemas import SuccessResponse

router = APIRouter()

@router.get("/models")
async def list_fine_tuning_models():
    """Return available fine-tuned models."""
    return SuccessResponse(data=[])

@router.get("/jobs")
async def list_fine_tuning_jobs():
    """Return fine-tuning job history."""
    return SuccessResponse(data=[])

@router.post("/jobs")
async def create_fine_tuning_job():
    """Create a new fine-tuning job."""
    return SuccessResponse(data={"id": "job-123", "status": "queued"})
