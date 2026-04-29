"""
background_tasks.py — API routes for triggering and monitoring background tasks.

Uses TaskIQ's ``.kiq()`` API instead of the legacy Celery ``.delay()`` calls.
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import asyncio
from database import get_db, async_session
from models import BackgroundProcessLog
from tasks import process_video_task
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/background-tasks", tags=["Background Tasks"])

@router.post("/video")
async def start_video_processing(payload: dict, db: AsyncSession = Depends(get_db)):
    # 1. Cria log no DB
    log = BackgroundProcessLog(
        process_name="Processamento de Vídeo",
        status="PENDENTE",
        details=payload
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    # 2. Envia para o TaskIQ via .kiq()
    task_result = await process_video_task.kiq(log.id, payload)

    # Atualiza com o task_id real
    log.task_id = task_result.task_id
    await db.commit()

    # Retorna Pydantic-compatible dict simulando o log
    return {
        "message": "Processamento iniciado",
        "log": {
            "id": log.id,
            "status": log.status,
            "process_name": log.process_name,
            "progress": log.progress
        }
    }

@router.get("/")
async def list_tasks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BackgroundProcessLog).order_by(desc(BackgroundProcessLog.created_at)))
    return result.scalars().all()

@router.get("/{log_id}")
async def get_task_details(log_id: int, db: AsyncSession = Depends(get_db)):
    log = await db.get(BackgroundProcessLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Process Log not found")
    return log

@router.delete("/{log_id}")
async def delete_task_log(log_id: int, db: AsyncSession = Depends(get_db)):
    log = await db.get(BackgroundProcessLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Process Log not found")

    # Remove entry
    await db.delete(log)
    await db.commit()
    return {"success": True}

@router.post("/{log_id}/cancel")
async def cancel_task(log_id: int, db: AsyncSession = Depends(get_db)):
    """Cancel a running task by marking it as ERRO in the database.

    Note: TaskIQ does not support remote task revocation like Celery's
    ``app.control.revoke``.  We mark the log entry as cancelled so the
    UI reflects the desired state.  The actual worker will finish its
    current iteration but subsequent status checks will see the
    cancellation.
    """
    log = await db.get(BackgroundProcessLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Process Log not found")

    if log.status in ["PENDENTE", "PROCESSANDO"]:
        log.status = "ERRO"
        log.error_message = "Cancelado pelo usuário"
        await db.commit()

    return {"success": True}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Poll the DB within a scoped session to avoid stalling
            async with async_session() as db:
                from datetime import datetime, timedelta
                result = await db.execute(
                    select(BackgroundProcessLog)
                    .where(
                        (BackgroundProcessLog.status.in_(["PENDENTE", "PROCESSANDO"])) |
                        ((BackgroundProcessLog.status.in_(["CONCLUIDO", "ERRO"])) & (BackgroundProcessLog.updated_at > datetime.utcnow() - timedelta(minutes=5)))
                    )
                    .order_by(desc(BackgroundProcessLog.updated_at))
                )
                active_tasks = result.scalars().all()
                payload = [
                    {
                        "id": t.id,
                        "status": t.status,
                        "progress": t.progress,
                        "process_name": t.process_name,
                        "error_message": t.error_message,
                        "updated_at": t.updated_at.isoformat() if t.updated_at else None
                    } for t in active_tasks
                ]

                await websocket.send_json(payload)

            await asyncio.sleep(2) # Envia update a cada 2s

    except WebSocketDisconnect:
        logger.info("Client disconnected from /ws")
    except Exception as e:
        logger.error(f"WS error: {e}")
