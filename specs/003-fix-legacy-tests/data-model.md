# Data Model: Test Stabilization

## Key Entities (Existing)

### BackgroundProcessLog
- **Type**: Relational (PostgreSQL)
- **Status**: Stable
- **Fields**:
  - `id`: Primary Key
  - `status`: [PROCESSANDO, CONCLUIDO, ERRO]
  - `progress`: [0-100]
  - `error_message`: string
  - `details`: JSONB
- **Impact**: Many backend tests validate the state transitions of this entity during background task execution.

### TaskIQ Result
- **Type**: Transient (RabbitMQ/Memory)
- **Status**: Replaces Celery Task
- **Fields**:
  - `task_id`: UUID
  - `return_value`: any
- **Impact**: Integration tests must mock this to verify task triggering logic.
