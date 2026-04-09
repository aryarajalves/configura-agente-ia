# Tasks: Ingestão de Dados & Gestão de Nuvem (Backblaze)

**Input**: Design documents from `/specs/005-cloud-ingestion-worker/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are generated for core logic (hash verification and state transitions) as requested by the need for traceability and error handling.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize ingestion module structure in `backend/src/`
- [ ] T002 Install dependencies `b2sdk`, `taskiq[redis]`, `hashlib` in `backend/requirements.txt`
- [ ] T003 [P] Configure Backblaze B2 environment variables in `.env` and `backend/src/core/config.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T004 Create `IngestionTask` SQLAlchemy model in `backend/src/models/ingestion.py`
- [ ] T005 Generate and run Alembic migration for `ingestion_tasks` table in `backend/alembic/versions/`
- [ ] T006 Implement `CloudService` for Backblaze B2 interaction (upload/delete) in `backend/src/services/cloud_service.py`
- [ ] T007 Configure TaskIQ broker and define `ia-priority` queue with concurrency=1 in `backend/src/tkq/tkq_config.py`
- [ ] T008 Setup Redis Pub/Sub utility for WebSocket notifications in `backend/src/core/redis_bus.py`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Ingestão "Zero Wait" (Priority: P1) 🎯 MVP

**Goal**: Permitir que o usuário envie um arquivo e receba um ID de tarefa instantaneamente, enquanto o upload ocorre em background.

**Independent Test**: Usar `curl` para postar um arquivo e verificar se o retorno é 202 Accepted com um `task_id` em < 1s.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Implement SHA256 stream hashing utility in `backend/src/utils/hashing.py`
- [ ] T010 [US1] Implement `IngestionService.create_task` with duplicate check in `backend/src/services/ingestion_service.py`
- [ ] T011 [US1] Create TaskIQ task `task_upload_to_b2` in `backend/src/tkq/tasks.py`
- [ ] T012 [US1] Implement `POST /api/v1/ingestion/upload` endpoint in `backend/src/api/v1/endpoints/ingestion.py`
- [ ] T013 [US1] Integrate `IngestionService` with `task_upload_to_b2` for async execution

**Checkpoint**: User Story 1 functional - Files are uploaded to B2 in background.

---

## Phase 4: User Story 2 - Monitoramento do Ciclo de Vida (Priority: P2)

**Goal**: Visualizar o progresso real do upload e processamento via logs e WebSockets.

**Independent Test**: Abrir uma conexão WebSocket para o `task_id` e observar a progressão das mensagens JSON de status.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Implement WebSocket endpoint for task monitoring in `backend/src/api/ws/ingestion.py`
- [ ] T015 [US2] Update `task_upload_to_b2` to publish progress increments to Redis Pub/Sub
- [ ] T016 [US2] Create secondary TaskIQ task `task_process_ia` on `ia-priority` queue in `backend/src/tkq/tasks.py`
- [ ] T017 [US2] Implement state transition from `uploading` to `processing` and finally `completed`
- [ ] T018 [US2] Add logic to delete file from B2 upon successful RAG update in `backend/src/tkq/tasks.py`
- [ ] T019 [US2] Implement detailed log capture within `IngestionTask.logs` JSON field

**Checkpoint**: User Story 2 functional - Real-time monitoring and full lifecycle cleanup complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T020 [P] Implement retry logic for failed B2 uploads in `backend/src/tkq/tasks.py`
- [ ] T021 Comprehensive unit tests for `IngestionService` (duplicate detection, state machine)
- [ ] T022 [P] Update API documentation (Swagger) with new ingestion endpoints
- [ ] T023 Run validation against `quickstart.md` scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Base for everything.
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS both user stories.
- **User Stories (Phase 3 & 4)**: All depend on Foundational.
  - US2 (Monitoring) depends on US1 (Task creation) for the `task_id`.

### Parallel Opportunities

- T003, T008 can run in parallel with model definitions.
- T009 (Hashing utility) can be developed independently of the API.
- T014 (WebSocket skeleton) can be developed in parallel with US1 implementation.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational.
2. Complete US1 (Upload and return ID).
3. **STOP and VALIDATE**: Verify file appears in B2 and task status is `uploading`.

### Incremental Delivery

1. Add US2 (Real-time updates and IA processing queue).
2. Refine error handling and cleanup.
