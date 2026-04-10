# Tasks: Update S3 Keys and Docker Local

**Branch**: `007-update-s3-docker`
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

## Phase 1: Setup
- [x] T001 [US1] Update `requirements.txt`: Remove `redis`, `celery`, `flower`, `taskiq[redis]`. Add `taskiq[aio-pika]`, `aio-pika`.
- [x] T002 [US1] Update `.env.example`: Replace `B2_*` with `S3_*`, remove `STR_REDIS_URL` and `CELERY_BROKER_URL`, add `S3_REGION` and `RABBITMQ_URL`.

## Phase 2: Core Infrastructure (RabbitMQ)
- [x] T003 [US3] Update `backend/src/tkq/tkq_config.py`: Replace `RedisBroker` with `AioPikaBroker`.
- [x] T004 [US3] Create `backend/src/core/message_bus.py`: Implement RabbitMQ Pub/Sub (replaces `RedisBus`).
- [x] T005 [US3] Replace all `RedisBus` imports/usages with `MessageBus` in `backend/src/tkq/tasks.py` and `backend/src/api/ws/ingestion.py`.
- [x] T006 [US3] Remove `backend/src/core/redis_bus.py`.

## Phase 3: Task Migration & Celery Removal
- [x] T007 [US1] Migrate all task logic from `backend/tasks.py` to a new TaskIQ-compatible module (or consolidate in `backend/src/tkq/tasks.py`).
- [x] T008 [US1] Remove `backend/tasks.py`, `backend/celery_app.py`, and `backend/celerybeat-schedule`.
- [x] T009 [US1] Update dependencies in any service mapping old Celery tasks to use the new TaskIQ tasks.

## Phase 4: Storage Refactoring
- [x] T010 [US1] Rename `B2_` variables to `S3_` in `backend/src/services/cloud_service.py` (or the equivalent S3 service).
- [x] T011 [US1] Ensure all references in the codebase (grep search) are updated to the new `S3_*` names.

## Phase 5: Docker & Local Environment (P2)
- [x] T012 [US2] Update `infra/docker-compose-local.yml`:
    - Remove `depends_on: db` from `backend`.
    - Join `network_swarm_public` (external).
    - Ensure `rabbitmq` is present and correctly configured.
- [x] T013 [US2] Update `infra/docker-compose-producao.yml`: Remove `redis`, `celery`, and `flower` services.
- [x] T014 [US2] Update `backend/src/core/config.py` to load `RABBITMQ_URL` and new S3 variables.

## Phase 6: Polish & Verification
- [x] T015 Verify application boots successfully with `docker-compose-local.yml`.
- [x] T016 Run a smoke test for task execution (e.g., file ingestion) using the new RabbitMQ broker.
- [x] T017 Run a smoke test for WebSocket state updates via the new `MessageBus`.
- [x] T018 Cleanup old `pyproject.toml` or other config if they mention Celery/Redis.

## Dependencies & Execution Order
1. Phase 1 (Setup) must be done first to ensure dependencies are available.
2. Phase 2 & 3 can be done in parallel.
3. Phase 4 (Storage) is independent.
4. Phase 5 requires Phase 1 variables to be available.
5. Phase 6 requires all previous phases.
