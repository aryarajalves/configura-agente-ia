# Data Model: TaskIQ Migration

## Existing Entities (Modified Persistence Logic)

### BackgroundProcessLog
- **Purpose**: Tracks background task status and progress for user visibility.
- **Fields**:
  - `id`: Primary Key
  - `status`: String (ENQUEUED, PROCESSANDO, CONCLUIDO, ERRO)
  - `progress`: Integer (0-100)
  - `error_message`: Text (if status is ERRO)
  - `details`: JSON (task-specific results, e.g., kb_id, transcription status)
  - `task_id`: String (stores TaskIQ task ID)
- **State Transitions**:
  - START: `status="PROCESSANDO"`, `progress=0`
  - INTERMEDIATE: `progress` updates (e.g., 5, 20, 45, 95)
  - SUCCESS: `status="CONCLUIDO"`, `progress=100`
  - FAILURE: `status="ERRO"`, `error_message` populated

## TaskIQ Broker & Scheduler Configuration
- **Broker**: RabbitMQ (`AioPikaBroker`)
- **Scheduler**: TaskIQ API Scheduler (`TaskiqScheduler`)
- **Queues**: Consolidated single queue (default).

## Dependencies Injection (TaskIQ)
- **Database Session**: `async_session` from `database.py` will be provided as a TaskIQ dependency.
