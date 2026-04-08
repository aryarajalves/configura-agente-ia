# API Contract: Hybrid Skill Management

## POST /v1/skills
Create a new skill.

Request:
```json
{
  "name": "Habilidade Híbrida de Produtos",
  "description": "Combina documentos e dados de preço por product_id",
  "type": "hibrida"
}
```

Response:
```json
{
  "skill_id": "uuid",
  "status": "draft"
}
```

## POST /v1/skills/{skill_id}/sources
Register a source for a skill version and start ingestion.

Request:
```json
{
  "source_type": "pdf",
  "source_uri": "s3://bucket/file.pdf",
  "metadata": {
    "filename": "manual.pdf"
  }
}
```

Response:
```json
{
  "skill_version_id": "uuid",
  "ingestion_status": "processing"
}
```

## GET /v1/skills/{skill_id}/status
Retrieve the current status of a skill and its active version.

Response:
```json
{
  "skill_id": "uuid",
  "status": "active",
  "active_version_id": "uuid",
  "version_status": "active",
  "last_processed_at": "2026-04-08T12:00:00Z"
}
```

## POST /v1/skills/{skill_id}/query
Run a hybrid query against the active skill version.

Request:
```json
{
  "question": "Qual é o preço deste item?",
  "product_id": "ABC123"
}
```

Response:
```json
{
  "answer": "O produto ABC123 custa R$ 199,90 com estoque disponível.",
  "source_context": "Descrição do produto extraída do documento",
  "price": 199.90,
  "stock": 12
}
```

## GET /v1/skills/{skill_id}/versions
List versions and their statuses.

Response:
```json
{
  "versions": [
    {"version_id": "uuid", "status": "active", "created_at": "..."},
    {"version_id": "uuid", "status": "processing", "created_at": "..."}
  ]
}
```

## POST /v1/skills/{skill_id}/versions/{version_id}/activate
Activate a pending version after validation.

Response:
```json
{
  "skill_id": "uuid",
  "version_id": "uuid",
  "status": "active"
}
```
