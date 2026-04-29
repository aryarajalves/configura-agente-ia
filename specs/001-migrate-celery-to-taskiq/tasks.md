# Tasks: Migrate Celery to TaskIQ and RabbitMQ

**Input**: Design documents from `/specs/001-migrate-celery-to-taskiq/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/`, `infra/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Update `backend/requirements.txt` (remove celery, redis, flower; add taskiq, taskiq-aio-pika, taskiq-api-scheduler)
- [x] T002 Update `infra/docker-compose-local.yml` to replace RabbitMQ image with `rabbitmq:3-management` and expose port 15672
- [x] T003 Remove Flower and Redis services from `infra/docker-compose-local.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create TaskIQ broker initialization in `backend/broker.py` using `AioPikaBroker`
- [x] T005 Setup TaskIQ dependencies for SQLAlchemy async session in `backend/broker.py`
- [x] T006 Configure `SimpleRetryMiddleware` in `backend/broker.py` (3 attempts, exponential backoff)
- [x] T007 [P] Create TaskIQ Scheduler instance and register tasks in `backend/broker.py`
- [x] T008 Update `backend/entrypoint.sh` to support consolidated worker and scheduler startup commands

**Checkpoint**: Foundation ready - TaskIQ infrastructure is initialized and ready for task registration.

---

## Phase 3: User Story 1 - Process Background Tasks (Priority: P1) 🎯 MVP

**Goal**: Migrate core background processing tasks to TaskIQ and ensure reliable execution.

**Independent Test**: Trigger a video processing task via the API and verify TaskIQ worker picks it up and updates `background_process_logs`.

### Implementation for User Story 1

- [x] T009 [US1] Refactor `backend/tasks.py` to use `@broker.task` instead of `@app.task`
- [x] T010 [US1] Update `backend/tasks.py` to use `TaskiqDepends` for database session injection (removing `asyncio.run` hacks)
- [x] T011 [US1] Implement `delete_old_process_logs_task` in `backend/tasks.py` (matching legacy scheduled task)
- [x] T012 [US1] Update `backend/background_tasks.py` service to use `task.kiq()` for all task invocations
- [x] T013 [US1] Update `backend/tasks.py` to include structured logging (e.g. `taskiq.logger`) for better visibility

**Checkpoint**: Core background tasks are operational via TaskIQ.

---

## Phase 4: User Story 2 - System Infrastructure Modernization (Priority: P2)

**Goal**: Clean up legacy Celery components and finalize consolidated worker deployment.

**Independent Test**: Verify that only `rabbitmq`, `backend`, `worker`, and `scheduler` containers are running and functional in Docker.

### Implementation for User Story 2

- [x] T014 [US2] Remove `backend/celery_app.py` and any remaining Celery references in `backend/`
- [x] T015 [US2] Consolidate `celery_worker`, `celery_worker_json`, and `celery_beat` into `worker` and `scheduler` services in `infra/docker-compose-local.yml`
- [x] T016 [US2] Update environment variables in `infra/docker-compose-local.yml` (replace `CELERY_BROKER_URL` with `RABBITMQ_URL`)
- [x] T017 [US2] Verify `entrypoint.sh` correctly routes commands to `taskiq worker` and `taskiq scheduler`

**Checkpoint**: Legacy infra removed and consolidated worker pool is live.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T018 Code cleanup of unused imports in `backend/tasks.py` and `backend/background_tasks.py`
- [x] T019 [P] Update architectural documentation in `README.md` to reflect TaskIQ/RabbitMQ stack
- [x] T020 Run `quickstart.md` validation to ensure local deployment works end-to-end
- [x] T021 [P] Fix `worker` port conflict (remove 8002:8000) and ensure `backend` and `worker` depend on `postgres` in `infra/docker-compose-local.yml`
- [x] T022 [P] Resolve frontend connectivity errors (ERR_EMPTY_RESPONSE) by verifying backend startup and CORS

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2).
- **User Story 2 (P2)**: Can start after Phase 1 and 2, but requires User Story 1 tasks to be refactored to fully remove legacy code.

---

## Parallel Example: Setup

```bash
# Launch environment clean-up and dependencies
Task: T001 Update requirements.txt
Task: T003 Remove Flower and Redis from docker-compose
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test a sample background task execution.

### Parallel Team Strategy

1. Together: Setup + Foundational.
2. Dev A: Refactor tasks and API calls (Phase 3).
3. Dev B: Clean up infra and Docker files (Phase 4).
