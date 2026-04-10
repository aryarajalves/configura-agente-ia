import uuid
import json
from src.api.websocket.monitor import manager

class BackgroundMonitorService:
    def __init__(self):
        pass

    async def update_process_progress(self, user_id: uuid.UUID, process_id: uuid.UUID, step_id: uuid.UUID, progress: float, current_step_name: str, status: str):
        payload = {
            "type": "process_update",
            "data": {
                "process_id": str(process_id),
                "name": "Ingestion RAG",
                "status": status,
                "total_progress": progress,
                "current_step_name": current_step_name,
                "is_active": True
            }
        }
        for connection in manager.active_connections.get(user_id, []):
            await manager.send_personal_message(json.dumps(payload), connection)
    async def emit_terminal_event(self, user_id: uuid.UUID, process_id: uuid.UUID, status: str, message: str, toast_type: str):
        payload = {
            "type": "process_terminal",
            "data": {
                "process_id": str(process_id),
                "status": status,
                "message": message,
                "toast_type": toast_type
            }
        }
        for connection in manager.active_connections.get(user_id, []):
            await manager.send_personal_message(json.dumps(payload), connection)

    async def log_step(self, step_id: uuid.UUID, level: str, message: str, metadata: dict = None):
        # In a real implementation, this would save to the database using LogEntry model
        print(f"[{level}] Step {step_id}: {message}")
        if metadata:
            print(f"Metadata: {json.dumps(metadata)}")

    async def retry_task(self, process_id: uuid.UUID):
        # In a real implementation, this would:
        # 1. Fetch step status from DB
        # 2. Trigger taskiq.broker.push with restart_from_step=X
        print(f"Retrying process {process_id}")
