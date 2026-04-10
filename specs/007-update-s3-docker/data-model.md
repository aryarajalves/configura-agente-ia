# Data Model: Infrastructure Refactoring

This feature does not introduce new database tables, but it modifies the interpretation of existing entities and environment variables.

## Environment Configuration

### S3 Settings (StorageClient)
The `StorageClient` will now consume generic S3 keys.
- **S3_ACCESS_KEY_ID**: (Formerly B2_KEY_ID)
- **S3_SECRET_ACCESS_KEY**: (Formerly B2_APPLICATION_KEY)
- **S3_BUCKET_NAME**: (Formerly B2_BUCKET_NAME)
- **S3_REGION**: (New) - Specifies the S3 region (e.g., `us-east-1` or provider specific).

### Broker Settings
- **RABBITMQ_URL**: (New) - Canonical URL for RabbitMQ `amqp://user:pass@host:port/`.

## Existing Entities Impact

### IngestionTask
- No schema changes.
- `remote_id`: Will store the S3 Key or Provider ID.

### BackgroundProcessLog
- Used by the migrated Celery tasks. No schema changes expected.

## State Transitions (Tasks)

| Transition | Event | Step Update |
|------------|-------|-------------|
| INITIATED -> UPLOADING | Task triggered | "Iniciando upload para S3..." |
| UPLOADING -> PROCESSING| Upload complete | "Processamento IA iniciado..." |
| PROCESSING -> COMPLETED| RAG Indexing done | "Concluído com sucesso." |
| ANY -> FAILED | Exception caught | "Erro: {message}" |
