# WebSocket API Contract: Process Progress

**Endpoint**: `ws://[host]/api/v1/ws/processes/{user_id}`

## 1. Server -> Client: State Update
Fired whenever a process progresses, completes, or fails.
```json
{
  "type": "process_update",
  "data": {
    "process_id": "uuid-here",
    "name": "Ingestion RAG",
    "status": "RUNNING",
    "total_progress": 45.5,
    "current_step_name": "Vectorizing Documents",
    "is_active": true
  }
}
```

## 2. Server -> Client: Completion Notification
Fired when the process enters a terminal state (Success or Error).
```json
{
  "type": "process_terminal",
  "data": {
    "process_id": "uuid-here",
    "status": "COMPLETED",
    "message": "Processo Ingestion RAG finalizado com sucesso.",
    "toast_type": "success"
  }
}
```
