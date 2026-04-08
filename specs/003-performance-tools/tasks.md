# Tasks: Performance & Aprimoramento (Módulo 3)

**Input**: Design documents from `/specs/003-performance-tools/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize and verify directory structure in `backend/src/models/`, `backend/src/services/`, and `backend/src/api/v1/`
- [x] T002 Verify `TaskIQ` and `RabbitMQ` connectivity in the local development environment
- [x] T003 [P] Configure `RapidFuzz` string similarity dependency in `backend/requirements.txt` or equivalent

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Define `StressTestPersona` and `StressTestSession` SQLAlchemy models in `backend/src/models/stress_test.py`
- [x] T005 Define `InboxItem` and `BackgroundTask` SQLAlchemy models in `backend/src/models/inbox.py`
- [x] T006 Generate and apply Alembic migration for all Performance module tables in `backend/alembic/versions/`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Stress Test Simulation (Priority: P1) 🎯 MVP

**Goal**: Enable Admins to run AI vs AI stress tests with real-time progress.

**Independent Test**: Use the API to trigger a Stress Test for a specific persona and verify that a TaskIQ job starts, updates progress in the database, and generates a Markdown report.

### Implementation for User Story 1

- [x] T007 [US1] Implement `StressTestService` for session management and TaskIQ job submission in `backend/src/services/stress_test_service.py`
- [x] T008 [US1] Create TaskIQ worker logic for the Stress Test simulation loop in `backend/src/workers/stress_test.py`
- [x] T009 [US1] Implement LangGraph nodes for the simulated conversation flow (Persona vs Agent) in `backend/src/services/simulation_orchestrator.py`
- [x] T010 [US1] Create Stress Test endpoints (`POST /stress-tests`, `GET /stress-tests/{id}/status`) in `backend/src/api/v1/stress_tests.py`
- [x] T011 [US1] Implement the "Stress Test Configuration" page on the frontend (Persona selection, log import) in `frontend/src/pages/Performance/StressTestConfig.tsx`
- [x] T012 [US1] Add real-time progress indicator on the frontend using polling or WebSockets in `frontend/src/components/ProgressIndicator.tsx`

**Checkpoint**: User Story 1 (Stress Test MVP) is functional and testable independently.

---

## Phase 4: User Story 2 - Curadoria no Inbox de Dúvidas (Priority: P1)

**Goal**: Review and resolve AI failures grouped by similarity.

**Independent Test**: Populate the Inbox with sample failures, verify they are grouped using string similarity, and resolve an item via the API.

### Implementation for User Story 2

- [x] T013 [US2] Implement `InboxService` with grouping logic (using string similarity) in `backend/src/services/inbox_service.py`
- [x] T014 [US2] Create Inbox retrieval and resolution endpoints (`GET /inbox`, `PUT /inbox/{id}/resolve`) in `backend/src/api/v1/inbox.py`
- [x] T015 [US2] Implement the "Inbox de Dúvidas" list view on the frontend with grouped failure cards in `frontend/src/pages/Inbox/InboxList.tsx`
- [x] T016 [US2] Create the "Inbox Detail" view for editing AI suggestions and saving resolutions in `frontend/src/pages/Inbox/InboxDetail.tsx`

**Checkpoint**: User Story 2 is functional with manual curation working.

---

## Phase 5: User Story 3 - Governança de Falhas e Correções (Priority: P2)

**Goal**: Discard/Block incoherent themes and perform versioned RAG updates.

**Independent Test**: Use the "Discard" and "Block" actions in the Inbox and verify the state change in the database. Perform a RAG update and verify the knowledge versioning.

### Implementation for User Story 3

- [x] T017 [US3] Add "Discard" and "Block Topic" logic to `InboxService` and `inbox.py` endpoints
- [x] T018 [US3] Implement RAG versioning logic to allow updates without downtime in `backend/src/services/rag_service_v2.py`
- [x] T019 [US3] Wire the Stress Test simulation to automatically create `InboxItem` cards for each detected failure in `backend/src/workers/stress_test.py`
- [x] T020 [US3] Add "Discard", "Block", and "Retry" buttons to the frontend Inbox interface in `frontend/src/pages/Inbox/InboxDetail.tsx`

**Checkpoint**: Full governance loop (Stress Test -> Inbox -> Resolve/Block -> RAG) is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Security, Performance, and Documentation

- [x] T021 [P] Rigorous authorization check for Inbox access (Admin/Curator role only) in `backend/src/api/auth.py`
- [x] T022 Implement cleanup tasks for old Stress Test logs and reports in `backend/src/workers/cleanup.py`
- [x] T023 Final validation of all scenarios defined in `specs/003-performance-tools/spec.md`
- [x] T024 Update `quickstart.md` with instructions for running a Stress Test and processing the Inbox

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all US implementation.
- **User Story 1 (P1)**: Depends on Foundational.
- **User Story 2 (P1)**: Depends on Foundational. Can run in parallel with US1.
- **User Story 3 (P2)**: Depends on US1 (to auto-create cards) and US2 (base curation endpoints).

### Parallel Opportunities

- T011 (Frontend US1) and T007-T009 (Backend US1) can run in parallel.
- T015 (Frontend US2) and T013-T014 (Backend US2) can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 & 2.
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: Verify a stress test can be run and a report is generated.

### Incremental Delivery

1. Foundation ready.
2. Stress Testing enabled (US1).
3. Inbox Curation enabled (US2).
4. Full Governance/RAG loop enabled (US3).
