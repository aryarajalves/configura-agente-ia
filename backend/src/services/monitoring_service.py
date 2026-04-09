"""Monitoring service — container health metrics and disk alert logic."""

import logging
import os
import shutil
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models.container_health_metric import ContainerHealthMetric
from backend.src.models.system_settings import SystemSettings

logger = logging.getLogger(__name__)


def _read_cgroup_memory() -> Dict[str, Any]:
    """Read memory metrics from cgroup v2 (or v1 fallback)."""
    try:
        # cgroup v2
        usage_path = "/sys/fs/cgroup/memory.current"
        max_path = "/sys/fs/cgroup/memory.max"
        if os.path.exists(usage_path) and os.path.exists(max_path):
            with open(usage_path) as f:
                usage = int(f.read().strip())
            with open(max_path) as f:
                raw = f.read().strip()
                limit = int(raw) if raw != "max" else usage  # "max" means no limit
            return {
                "usage_bytes": usage,
                "limit_bytes": limit,
                "available_bytes": max(limit - usage, 0),
                "percent": round((usage / limit) * 100, 2) if limit > 0 else 0,
            }
    except Exception as e:
        logger.debug("cgroup v2 memory read failed: %s", e)

    try:
        # cgroup v1 fallback
        usage_path = "/sys/fs/cgroup/memory/memory.usage_in_bytes"
        limit_path = "/sys/fs/cgroup/memory/memory.limit_in_bytes"
        if os.path.exists(usage_path) and os.path.exists(limit_path):
            with open(usage_path) as f:
                usage = int(f.read().strip())
            with open(limit_path) as f:
                limit = int(f.read().strip())
            return {
                "usage_bytes": usage,
                "limit_bytes": limit,
                "available_bytes": max(limit - usage, 0),
                "percent": round((usage / limit) * 100, 2) if limit > 0 else 0,
            }
    except Exception as e:
        logger.debug("cgroup v1 memory read failed: %s", e)

    # Host fallback using /proc/meminfo
    try:
        with open("/proc/meminfo") as f:
            info = {}
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = int(parts[1].strip().split()[0]) * 1024  # kB -> bytes
                    info[key] = val
            total = info.get("MemTotal", 0)
            available = info.get("MemAvailable", 0)
            used = total - available
            return {
                "usage_bytes": used,
                "limit_bytes": total,
                "available_bytes": available,
                "percent": round((used / total) * 100, 2) if total > 0 else 0,
            }
    except Exception as e:
        logger.warning("Could not read memory info: %s", e)

    return {"usage_bytes": 0, "limit_bytes": 0, "available_bytes": 0, "percent": 0}


def _read_disk_usage() -> Dict[str, Any]:
    """Read disk usage from the filesystem root."""
    try:
        total, used, free = shutil.disk_usage("/")
        percent = round((used / total) * 100, 2) if total > 0 else 0
        return {
            "usage_bytes": used,
            "total_bytes": total,
            "available_bytes": free,
            "percent": percent,
        }
    except Exception as e:
        logger.warning("Could not read disk usage: %s", e)
        return {"usage_bytes": 0, "total_bytes": 0, "available_bytes": 0, "percent": 0}


def collect_system_metrics() -> Dict[str, Any]:
    """Collect current container health metrics."""
    disk = _read_disk_usage()
    mem = _read_cgroup_memory()
    return {
        "disk_usage_percent": disk["percent"],
        "memory_usage_percent": mem["percent"],
        "disk_available_bytes": disk["available_bytes"],
        "memory_available_bytes": mem["available_bytes"],
        "timestamp": datetime.utcnow().isoformat(),
    }


async def persist_health_snapshot(db: AsyncSession, container_id: Optional[str] = None) -> ContainerHealthMetric:
    """Take a health snapshot and persist it."""
    metrics = collect_system_metrics()
    record = ContainerHealthMetric(
        disk_usage_percent=Decimal(str(metrics["disk_usage_percent"])),
        memory_usage_percent=Decimal(str(metrics["memory_usage_percent"])),
        container_id=container_id or os.environ.get("HOSTNAME", "unknown"),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def check_threshold_alert(db: AsyncSession) -> Optional[str]:
    """Check if disk usage exceeds the configured threshold. Returns alert message or None."""
    from backend.src.services.settings_service import get_or_create_settings

    settings = await get_or_create_settings(db)
    disk = _read_disk_usage()

    if disk["percent"] >= settings.storage_threshold_alert:
        msg = (
            f"⚠️ Alerta de Armazenamento: Uso de disco em {disk['percent']}% "
            f"(limite configurado: {settings.storage_threshold_alert}%). "
            f"Espaço livre: {disk['available_bytes'] / (1024**3):.1f} GB."
        )
        logger.warning(msg)
        return msg
    return None
