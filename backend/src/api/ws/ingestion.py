from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
from src.core.redis_bus import RedisBus
import json

router = APIRouter()

@router.websocket("/stream/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    
    redis_bus = RedisBus()
    pubsub = await redis_bus.subscribe(f"task:{task_id}")
    
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                await websocket.send_text(message['data'].decode('utf-8'))
            else:
                await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        print(f"Client disconnected from task {task_id}")
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        await redis_bus.unsubscribe(pubsub)
