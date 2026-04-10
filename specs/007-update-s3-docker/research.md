# Research: Redis to RabbitMQ Migration for 007-update-s3-docker

## TaskIQ Broker Migration

### Decision
Replace `taskiq-redis` with `taskiq-aio-pika`.

### Rationale
- RabbitMQ is already defined as the canonical message broker in the Constitution.
- `taskiq-aio-pika` provides a high-performance asynchronous RabbitMQ broker for TaskIQ.
- Consolidates infrastructure by removing the Redis dependency.

### Alternatives Considered
- **InMemoryBroker**: Rejected because it doesn't support distributed workers or persistence.
- **TaskIQ NATS**: Rejected because RabbitMQ is already in use/preferred.

---

## Event Bus Migration (RedisBus to MessageBus)

### Decision
Implement a `MessageBus` using `aio-pika` to handle Pub/Sub directly via RabbitMQ exchanges.

### Implementation Pattern
- Create an `Exchange` (e.g., `events.fanout`).
- `publish` sends a message to the exchange.
- `subscribe` creates a temporary queue bound to the exchange.

---

## Celery Removal

### Decision
Migrate all tasks from `backend/tasks.py` to `backend/src/tkq/tasks.py` (or a unified task registry).

### Task Mapping
| Celery Task | TaskIQ Equivalent |
|-------------|-------------------|
| `process_video_task` | `task_process_video` |
| `process_kb_media_task` | `task_process_kb_media` |
| `process_kb_json_item_task` | `task_process_kb_json_item` |
| `delete_old_process_logs_task` | Use TaskIQ scheduler (in-memory or permanent) |

---

## Environment Variable Mapping

### S3 Standardization
- `B2_KEY_ID` -> `S3_ACCESS_KEY_ID`
- `B2_APPLICATION_KEY` -> `S3_SECRET_ACCESS_KEY`
- `B2_BUCKET_NAME` -> `S3_BUCKET_NAME`
- `STR_REDIS_URL` -> (Removed)
- `S3_REGION` -> (Added)

### RabbitMQ Standardization
- `CELERY_BROKER_URL` -> (Removed)
- `RABBITMQ_URL` -> (Added, e.g., `amqp://guest:guest@rabbitmq:5672/`)

---

## Technical Unknowns Resolved

1. **How to handle periodic tasks without Celery Beat?**
   - TaskIQ has a `taskiq-redis` scheduler, but since we are removing Redis, we will use a Simple Scheduler or `taskiq-aio-pika`'s capabilities if available, or just a background loop in the main process if acceptable for small tasks like log cleanup.
2. **FastAPI Lifespan for TaskIQ?**
   - Must call `broker.startup()` and `broker.shutdown()` in the FastAPI lifespan handler.
3. **Queue Names?**
   - TaskIQ defaults to specific queues. We will configure them to match the project's needs (e.g., standard and `json_processing`).
