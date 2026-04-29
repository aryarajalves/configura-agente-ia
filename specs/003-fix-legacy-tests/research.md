# Research: Legacy Test Stabilization

## Decision: Implementation Path for Infrastructure Fixes
- **Backend Port Fix**: Standardize on port 5433 for PostgreSQL as defined in the current `docker-compose-local.yml` and expected by the user.
- **Frontend Port Fix**: Standardize on port 5300 for the frontend and port 8002 for the backend API calls within frontend tests.
- **TaskIQ Mocking Strategy**: Use `unittest.mock` to patch the `.kiq()` method of the TaskIQ broker or specific tasks to verify background triggers without requiring a running RabbitMQ instance during unit tests.

## Rationale
- The user explicitly requested to keep the "current" ports (8002, 5300, 5433) to maintain compatibility with their existing setup.
- TaskIQ replaced Celery, so all `.delay()` mocks must be updated to `.kiq()` mocks or `task.send_with_options` depending on the use case.
- Running tests in Docker (as requested) ensures that environment variables like `DATABASE_URL` are correctly populated via Docker networking (e.g., `db:5433`).

## Alternatives Considered
- **Switching to standard ports (8000/5173)**: Rejected because the user specifically asked to keep 8002/5300.
- **In-memory SQLite for tests**: Rejected because pgvector is a strict requirement (Principle I) and SQLite doesn't support it easily. PostgreSQL (port 5433) must be used.

## TaskIQ Configuration Reference
- **Broker**: `AioPikaBroker`
- **Url**: `amqp://guest:guest@rabbitmq:5672//`
- **Middleware**: `SimpleRetryMiddleware`
- **Tasks**: Defined in `backend/tasks.py` using `@broker.task`.
- **Invocation Pattern**: `task_name.kiq(args)`
