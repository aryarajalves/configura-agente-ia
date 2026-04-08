# Tasks: Performance & Aprimoramento (Módulo 3)

**Input**: Design documents from `/specs/003-performance-tools/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/stress-test-inbox-api.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature documentation and verify existing background execution infrastructure.

- [ ] T001 [P] Review and update `specs/003-performance-tools/plan.md` and `specs/003-performance-tools/research.md` to ensure design artifacts match current repo conventions.
- [ ] T002 [P] Confirm TaskIQ broker configuration in `backend/src/workers/broker.py` supports RabbitMQ and add any missing startup hooks for stress-test workers.
- [ ] T003 [P] Update `specs/003-performance-tools/quickstart.md` with exact backend run commands, worker startup steps, and environment variable references for `TASKIQ_BROKER_URL` and `RABBITMQ_URL`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the backend data model, service scaffolding, and authorization needed by all user stories.

- [ ] T004 [P] Implement `StressTest_Persona` and `StressTest_Session` SQLAlchemy models in `backend/src/models/stress_test.py` using the data model fields defined in `specs/003-performance-tools/data-model.md`.
- [ ] T005 [P] Implement `Inbox_Item` and `Background_Task` SQLAlchemy models in `backend/src/models/inbox.py` with semantic grouping, status, and technical log fields.
- [ ] T006 [P] Add an Alembic migration file under `backend/alembic/versions/` to create the `stress_test_persona`, `stress_test_session`, `inbox_item`, and `background_task` tables.
- [ ] T007 [P] Create `backend/src/services/stress_test_service.py` with session creation, TaskIQ task submission, progress persistence, timeout handling, and report link storage.
- [ ] T008 [P] Create `backend/src/services/inbox_service.py` with grouping logic, suggestion editing, resolve/discard/block actions, and versioned RAG update support.
- [ ] T009 [P] Add TaskIQ job definitions in `backend/src/workers/stress_test.py` and update `backend/src/workers/tasks.py` so stress-test processing and technical logs are executed as TaskIQ background jobs.
- [ ] T010 [P] Add JWT role checks and admin/curator authorization scaffolding in `backend/src/api/v1/stress_tests.py` and `backend/src/api/v1/inbox.py`.

---

## Phase 3: User Story 1 - Stress Test Simulation (Priority: P1) 🎯 MVP

**Goal**: Enable Admins to start persona-driven Stress Test sessions and monitor TaskIQ progress in real time.

**Independent Test**: Create a stress test session, verify a TaskIQ job is queued, and confirm `status` and `progress_percentage` update correctly.

- [ ] T011 [US1] Implement `POST /api/admin/stress-tests` in `backend/src/api/v1/stress_tests.py` to start a new `StressTest_Session` and submit the TaskIQ job.
- [ ] T012 [US1] Implement `GET /api/admin/stress-tests/{stress_test_id}` in `backend/src/api/v1/stress_tests.py` to return session status, progress, and task metadata.
- [ ] T013 [US1] Implement `GET /api/admin/stress-tests/{stress_test_id}/report` in `backend/src/api/v1/stress_tests.py` to return `relatorio_md_link` and report metadata.
- [ ] T014 [US1] Implement progress persistence and timeout/error state transitions in `backend/src/services/stress_test_service.py` for TaskIQ-driven sessions.
- [ ] T015 [US1] Add real-time progress update support in `backend/src/services/stress_test_service.py` or existing websocket/polling integration layer, ensuring UI latency stays under 3 seconds.
- [ ] T016 [US1] Add backend tests for stress test session creation, status polling, and timeout/error transitions in `backend/tests/test_stress_test.py`.

---

## Phase 4: User Story 2 - Curadoria no Inbox de Dúvidas (Priority: P1)

**Goal**: Let authorized users review grouped failures, edit AI suggestions, and save final responses to the knowledge base.

**Independent Test**: Open the Inbox, verify grouped items appear, edit a suggestion, and persist the final response.

- [ ] T017 [P] [US2] Implement `GET /api/admin/inbox-items` in `backend/src/api/v1/inbox.py` with filters for `status`, `group_id`, paging, and sorting by frequency.
- [ ] T018 [US2] Implement semantic grouping and frequency tracking in `backend/src/services/inbox_service.py` using pgvector similarity or repeat-failure heuristics.
- [ ] T019 [US2] Implement edit/accept workflow in `backend/src/services/inbox_service.py` to persist `resposta_final_usuario` and update item `status`.
- [ ] T020 [P] [US2] Add inbox item listing and grouping integration tests in `backend/tests/test_inbox.py` covering similar-failure grouping and accepted suggestion persistence.

---

## Phase 5: User Story 3 - Governaça de Falhas e Correções (Priority: P2)

**Goal**: Provide discard/block actions and safe RAG versioning so bad suggestions do not corrupt the knowledge base.

**Independent Test**: Resolve, discard, and block an Inbox item and verify the item state and RAG update behavior.

- [ ] T021 [US3] Implement `POST /api/admin/inbox-items/{id}/resolve` in `backend/src/api/v1/inbox.py` to save the final user response and optionally apply it to the RAG base.
- [ ] T022 [US3] Implement `POST /api/admin/inbox-items/{id}/discard` in `backend/src/api/v1/inbox.py` to mark an item as discarded and prevent it from updating the RAG.
- [ ] T023 [US3] Implement `POST /api/admin/inbox-items/{id}/block-topic` in `backend/src/api/v1/inbox.py` to mark an item as blocked and prevent similar topics from being persisted.
- [ ] T024 [US3] Implement versioned RAG update handling in `backend/src/services/inbox_service.py` to preserve agent availability during knowledge persist operations, using soft delete and independent skill tables per constitution III.
- [ ] T025 [US3] Add governance tests in `backend/tests/test_inbox_governance.py` covering resolve/discard/block actions and safe versioned persistence.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure documentation, API contract, and behavior match the final implementation.

- [ ] T026 [P] Update `specs/003-performance-tools/contracts/stress-test-inbox-api.md` to reflect the final implemented endpoint names, request shapes, and role restrictions.
- [ ] T027 [P] Update `specs/003-performance-tools/quickstart.md` with any implementation-specific environment or run commands discovered during development.
- [ ] T028 [P] Add or update backend tests under `backend/tests/` for authorization and error scenarios across the Stress Test and Inbox API flows.
- [ ] T029 [P] Review and refine `backend/src/services/stress_test_service.py` and `backend/src/services/inbox_service.py` to ensure all functional requirements from `specs/003-performance-tools/spec.md` are covered.
- [ ] T030 [P] Add integration test for SC-003 in `backend/tests/test_stress_test_integration.py` to validate that 100% of errors from Stress Tests generate corresponding Inbox cards.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** can start immediately.
- **Phase 2: Foundational** depends on Phase 1 completion and blocks all story work.
- **Phase 3+ User Story phases** depend on Foundational completion.
- **Phase 6: Polish** depends on all user story implementation tasks.

### User Story Dependencies

- **US1**: No dependencies beyond foundational services and models.
- **US2**: Depends on Inbox model, service scaffolding, and role-based access.
- **US3**: Depends on Inbox service workflow and RAG versioning support.

### Parallel Opportunities

- Tasks marked `[P]` can be worked on in parallel across different files.
- Phase 1 and Phase 2 setup tasks are parallelizable where they do not depend on each other.
- US2 and US3 can start after foundational models and services are in place and can be staffed in parallel by separate developers.
- Documentation and contract updates in Phase 6 are parallelizable with backend implementation cleanup.

## Suggested MVP Scope

- Complete Phase 1 and Phase 2 foundational work.
- Deliver Phase 3: Stress Test Simulation first as the core MVP.
- Add US2 Inbox curation next, then US3 governance controls.
- Use Phase 6 for final alignment and tests.
