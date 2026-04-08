# API Contract: Hybrid Skill Management

## POST /api/v1/skills
Create a new skill.

Request:
```json
{
  "name": "Habilidade Híbrida de Produtos",
  "description": "Combina documentos e dados de preço",
  "target_table": "products"
}
```

Response:
```json
{
  "id": "uuid",
  "name": "Habilidade Híbrida de Produtos",
  "active_version_id": null
}
```

## POST /api/v1/skills/{skill_id}/sources
Register a static source.

Request:
```json
{
  "source_type": "pdf",
  "uri": "s3://bucket/file.pdf",
  "metadata_": {
    "product_id": "ABC123"
  }
}
```

Response:
```json
{
  "id": "uuid",
  "skill_version_id": "uuid",
  "source_type": "pdf",
  "uri": "s3://bucket/file.pdf"
}
```

## POST /api/v1/skills/{skill_id}/versions
Triggers ingestion for the latest pending version.

Response:
```json
{
  "status": "ingestion_started",
  "version_id": "uuid",
  "job_id": "uuid"
}
```

## GET /api/v1/skills/{skill_id}/versions/latest
Retrieve the current status of the latest tracked version.

Response:
```json
{
  "version_id": "uuid",
  "version_status": "processing",
  "last_processed_at": "2026-04-08T12:00:00Z"
}
```

## POST /api/v1/skills/{skill_id}/query
Run a hybrid query against the active skill version.

Request:
```json
{
  "query": "Qual é o preço deste item?",
  "context": {
    "product_id": "ABC123"
  }
}
```

Response:
```json
{
  "answer": "O produto ABC123 custa R$ 99.99 com estoque de 150.",
  "sources": [
    {
      "product_id": "ABC123",
      "context": "Context extracted from vector"
    }
  ],
  "metadata_": {
    "price": 99.99,
    "stock": 150
  }
}
```

## POST /api/v1/skills/{skill_id}/versions/latest/activate
Activate a fully processed pending version.

Response:
```json
{
  "status": "activated",
  "active_version_id": "uuid"
}
```

## POST /api/v1/skills/{skill_id}/versions/latest/retry
Retry processing for an errored or attention version.

Response:
```json
{
  "status": "retry_queued"
}
```
