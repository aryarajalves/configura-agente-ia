"""System Metrics API — container health monitoring endpoint."""

from fastapi import APIRouter, Depends

from src.api.auth import get_owner_or_superadmin
from src.services.monitoring_service import collect_system_metrics

router = APIRouter()


@router.get("/")
async def get_system_metrics(
    admin: dict = Depends(get_owner_or_superadmin),
):
    """T023 [US1]: Expose disk_usage_percent, memory_usage_percent, and available bytes."""
    metrics = collect_system_metrics()
    return metrics
