# Tasks: Painel de Controle de Processos (Background)

**Input**: Design documents from `/specs/006-background-process-monitor/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize React UI components folder for ProcessMonitor in frontend/src/components/ProcessMonitor/
- [ ] T002 Configure base WebSocket API routes structure in backend/src/api/websocket/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented
**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create Process and Step models in backend/src/models/process.py
- [ ] T004 Create LogEntry model in backend/src/models/process_log.py
- [ ] T005 Create Alembic migration for background process models in backend/alembic/versions/
- [ ] T006 Implement base TaskIQ monitor dependencies in backend/src/services/background_monitor_service.py
- [ ] T007 Set up FastAPI WebSocket monitor router in backend/src/api/websocket/monitor.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Monitoramento em Tempo Real (Priority: P1) 🎯 MVP

**Goal**: O usuário ou sistema enxerga a barra de progresso sendo atualizada em tempo real considerando o peso de cada etapa.

**Independent Test**: Can be independently tested by firing a mock task that increments progress on predefined weights.

### Implementation for User Story 1

- [ ] T008 [P] [US1] Implement function to dispatch websocket update on step tick in backend/src/services/background_monitor_service.py
- [ ] T009 [P] [US1] Build useProcesses.ts hook for websocket connection and state parsing in frontend/src/queries/useProcesses.ts
- [ ] T010 [US1] Build ProcessProgressBar component in frontend/src/components/ProcessMonitor/ProcessProgressBar.tsx
- [ ] T011 [US1] Integrate ProcessProgressBar in top menu dashboard in frontend/src/pages/ProcessDashboard.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Notificação de Conclusão (Priority: P1)

**Goal**: Obter feedback assíncrono de término do processo, independentemente da página atual.

**Independent Test**: Can be tested by navigating to another route while a mock process hits its terminal/completed state via WebSocket.

### Implementation for User Story 2

- [ ] T012 [P] [US2] Emit terminal process state events upon task finalization in backend/src/services/background_monitor_service.py
- [ ] T013 [P] [US2] Add completion listener logic in useProcesses.ts in frontend/src/queries/useProcesses.ts
- [ ] T014 [US2] Trigger UI Snackbar toast on terminal message in frontend/src/components/ProcessMonitor/ProcessToast.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Acesso a Logs Hierárquicos (Priority: P2)

**Goal**: Permitir que usuários ou administradores analisem logs detalhados quando um processo falha.

**Independent Test**: Can be tested by forcing an error in a task step and checking if the expansion section of the UI handles the metadata payload correctly.

### Implementation for User Story 3

- [ ] T015 [P] [US3] Ensure TaskIQ error callbacks log stacktraces to LogEntry in backend/src/services/background_monitor_service.py
- [ ] T016 [P] [US3] Add API route to fetch hierarchical logs for a process ID in backend/src/api/routes/processes.py
- [ ] T017 [US3] Implement LogViewer modal/accordion logic in frontend/src/components/ProcessMonitor/LogViewer.tsx

**Checkpoint**: All user stories up to P2 should now be independently functional

---

## Phase 6: User Story 4 - Retry Inteligente (Checkpointing) (Priority: P2)

**Goal**: Evitar o retrabalho quando um pipeline falha no meio do processo, reiniciando apenas da falha.

**Independent Test**: Can be tested by pausing/failing a mock pipeline, then triggering the resume endpoint with the failed execution ID.

### Implementation for User Story 4

- [ ] T018 [P] [US4] Add POST /api/v1/processes/{id}/retry endpoint in backend/src/api/routes/processes.py
- [ ] T019 [US4] Implement logic to spawn TaskIQ worker from last incomplete step in backend/src/services/background_monitor_service.py
- [ ] T020 [US4] Add Retry button to failed processes in frontend/src/components/ProcessMonitor/ProcessCard.tsx

---

## Phase 7: User Story 5 - Limpeza de Histórico Selecionada (Priority: P3)

**Goal**: Permitir a exclusão em massa ou manual de processos finalizados.

**Independent Test**: Can be tested by selecting rows in the datagrid and triggering batch delete.

### Implementation for User Story 5

- [ ] T021 [P] [US5] Implement bulk delete API checking admin flag or user_id in backend/src/api/routes/processes.py
- [ ] T022 [P] [US5] Add DELETE function to data grid in frontend/src/pages/ProcessDashboard.tsx

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T023 [P] Configure daily cron job worker for process history auto-cleanup in backend/worker/tasks/cleanup.py
- [ ] T024 Code cleanup and refactoring
- [ ] T025 Run quickstart.md validation locally using mock endpoints

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Expands on US1's hook.
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Should be independently testable via API.
- **User Story 4 (P2)**: Can start after Foundational (Phase 2)
- **User Story 5 (P3)**: Can start after Foundational (Phase 2)

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (Models and Router setup).
- Developer A can implement US1 and US2 (Frontend Core and Websocket Stream).
- Developer B can implement US3 and US4 (Logging, Metadata Storage, and TaskIQ Retry Dispatch).

---

## Parallel Example: User Story 1

```bash
# Launch Models and Websocket hook for User Story 1 together:
Task: "T008 [P] [US1] Implement function to dispatch websocket update on step tick in backend/src/services/background_monitor_service.py"
Task: "T009 [P] [US1] Build useProcesses.ts hook for websocket connection and state parsing in frontend/src/queries/useProcesses.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready
