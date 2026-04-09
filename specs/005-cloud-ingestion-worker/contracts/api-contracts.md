# API Contracts: Ingestion & Cloud Management

## Endpoints

### 1. Iniciar Ingestão (Async)
Inicia o processo de upload e processamento.

- **URL**: `POST /api/v1/ingestion/upload`
- **Auth**: Required (Admin/Owner)
- **Content-Type**: `multipart/form-data`
- **Request**:
  - `file`: File (binary, max 2GB)
- **Response (202 Accepted)**:
  ```json
  {
    "task_id": "uuid-string",
    "status": "initiated",
    "message": "Upload task started. Follow progress via WebSocket."
  }
  ```

### 2. Consultar Status da Tarefa
- **URL**: `GET /api/v1/ingestion/tasks/{task_id}`
- **Response (200 OK)**:
  ```json
  {
    "id": "uuid-string",
    "filename": "video_aula.mp4",
    "status": "uploading",
    "progress": 45,
    "current_step": "Transferindo para Backblaze B2",
    "created_at": "2026-04-09T14:00:00Z"
  }
  ```

### 3. Stream de Progresso (WebSocket)
- **URL**: `WS /ws/v1/ingestion/{task_id}`
- **Payload (Server -> Client)**:
  ```json
  {
    "task_id": "uuid-string",
    "status": "processing",
    "progress": 80,
    "log": "[14:05] Iniciando Vetorização..."
  }
  ```

## Error Codes
- `CLOUD_UPLOAD_ERROR`: Failure during B2 transfer.
- `DUPLICATE_FILE_ERROR`: File hash already exists in active processing.
- `FILE_TOO_LARGE`: Exceeds the 2GB limit.
