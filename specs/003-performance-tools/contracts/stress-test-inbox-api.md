# API Contract: Stress Test & Inbox Curation

## Authentication

- All endpoints require JWT authentication.
- Allowed roles: `admin`, `curator` for Inbox and Stress Test management.

## Stress Test Endpoints

### POST /api/admin/stress-tests

Request:
```json
{
  "persona_id": "uuid",
  "log_source": "string",
  "conversation_log": "string",
  "metadata": {
    "initial_score": 0.0,
    "tags": ["low-score","customer-issue"]
  }
}
```

Response:
```json
{
  "stress_test_id": "uuid",
  "status": "queued",
  "task_id": "string"
}
```

### GET /api/admin/stress-tests/{stress_test_id}

Response:
```json
{
  "stress_test_id": "uuid",
  "persona_id": "uuid",
  "status": "processing",
  "progress_percentage": 42,
  "started_at": "2026-04-08T12:00:00Z",
  "error_message": null
}
```

### GET /api/admin/stress-tests/{stress_test_id}/report

Response:
```json
{
  "stress_test_id": "uuid",
  "relatorio_md_link": "https://.../report.md"
}
```

## Inbox Endpoints

### GET /api/admin/inbox-items

Query params:
- `status` (optional): `pendente`, `resolvido`, `descartado`, `bloqueado`
- `group_id` (optional)
- `page` and `limit`

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "pergunta_original": "string",
      "falha_detectada": "string",
      "sugestao_ia": "string",
      "frequencia_erro": 5,
      "status": "pendente",
      "group_id": "uuid"
    }
  ],
  "page": 1,
  "limit": 25,
  "total": 32
}
```

### POST /api/admin/inbox-items/{id}/resolve

Request:
```json
{
  "resposta_final_usuario": "string",
  "apply_to_rag": true
}
```

Response:
```json
{
  "id": "uuid",
  "status": "resolvido"
}
```

### POST /api/admin/inbox-items/{id}/discard

Response:
```json
{
  "id": "uuid",
  "status": "descartado"
}
```
```

### POST /api/admin/inbox-items/{id}/block-topic

Response:
```json
{
  "id": "uuid",
  "status": "bloqueado"
}
```

## Error Handling

- `401 Unauthorized` if JWT is missing or invalid.
- `403 Forbidden` if the user is not `admin` or `curator`.
- `404 Not Found` if the requested resource does not exist.
- `422 Unprocessable Entity` for invalid request payloads.
