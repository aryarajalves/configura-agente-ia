from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
from src.core.message_bus import message_bus
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/stream/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    
    # Subscribe to AMQP topic for this task
    queue = await message_bus.subscribe(f"task:{task_id}")
    
    try:
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    # Send decoded body directly to client
                    await websocket.send_text(message.body.decode())
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from task {task_id}")
    except Exception as e:
        logger.error(f"WebSocket Error for task {task_id}: {e}")
    finally:
        # Exclusive queue will be deleted automatically on connection close 
        # because MessageBus.subscribe creates an exclusive queue.
        pass
