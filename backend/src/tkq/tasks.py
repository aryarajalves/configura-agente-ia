from src.tkq.tkq_config import broker
from src.services.cloud_service import CloudService
from database import engine, async_session
from src.models.ingestion import IngestionTask, IngestionStatus
from sqlalchemy.future import select
from src.core.redis_bus import RedisBus
import asyncio
import json
import os

async def _publish_state(task_id: str, status: str, step: str, progress: int, error: str = None):
    redis = RedisBus()
    payload = {
        "task_id": task_id,
        "status": status,
        "step": step,
        "progress": progress
    }
    if error:
        payload["error"] = error
    await redis.publish(f"task:{task_id}", json.dumps(payload))

@broker.task
async def task_upload_to_b2(task_id: str, local_path: str, remote_filename: str):
    async with async_session() as db:
        result = await db.execute(select(IngestionTask).where(IngestionTask.id == task_id))
        task = result.scalars().first()
        if not task:
            return

        task.status = IngestionStatus.UPLOADING
        task.current_step = f"Iniciando upload para B2: {remote_filename}"
        task.progress = 10
        await db.commit()
        await _publish_state(task_id, task.status.value, task.current_step, task.progress)

        try:
            cloud_service = CloudService()
            loop = asyncio.get_running_loop()
            # Try up to 3 times to upload
            max_retries = 3
            remote_id = None
            for attempt in range(1, max_retries + 1):
                try:
                    remote_id = await loop.run_in_executor(
                        None, 
                        cloud_service.upload_file, 
                        local_path, 
                        remote_filename
                    )
                    break # Success
                except Exception as upload_err:
                    if attempt == max_retries:
                        raise upload_err
                    # Publish retry state directly
                    await _publish_state(task_id, task.status.value, f"Falha no upload. Tentativa {attempt}/{max_retries}... Reconectando.", task.progress)
                    await asyncio.sleep(2 * attempt)

            task.remote_id = remote_id
            task.status = IngestionStatus.PROCESSING
            task.current_step = "Upload concluído. Iniciando processamento..."
            task.progress = 50
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress)

            # Cleanup local temporary file
            if os.path.exists(local_path):
                os.remove(local_path)

            # Trigger processing task (for US2)
            await task_process_ia.kiq(task_id, remote_id, remote_filename)

        except Exception as e:
            task.status = IngestionStatus.FAILED
            task.error_message = str(e)
            task.current_step = "Erro no upload."
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress, str(e))
            raise

@broker.task
async def task_process_ia(task_id: str, remote_id: str, remote_filename: str):
    async with async_session() as db:
        result = await db.execute(select(IngestionTask).where(IngestionTask.id == task_id))
        task = result.scalars().first()
        if not task:
            return

        task.current_step = "Indexando no RAG..."
        task.progress = 75
        await db.commit()
        await _publish_state(task_id, task.status.value, task.current_step, task.progress)

        try:
            # Here goes the actual RAG pipeline simulator
            await asyncio.sleep(2)
            
            task.status = IngestionStatus.COMPLETED
            task.current_step = "Processamento concluído."
            task.progress = 100
            
            import time
            log_entry = {"event": "RAG Extraction Successful", "timestamp": time.time()}
            # sqlalchemy JSON column assignment rule
            current_logs = task.logs or []
            task.logs = current_logs + [log_entry]
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress)

            # Cleanup B2 file
            cloud = CloudService()
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, cloud.delete_file, remote_filename, remote_id)
            
        except Exception as e:
            task.status = IngestionStatus.FAILED
            task.error_message = str(e)
            task.current_step = "Erro no processamento IA."
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress, str(e))
            raise
