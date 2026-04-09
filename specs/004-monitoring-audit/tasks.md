# Tasks: Monitorização e Auditoria (Módulo 4)

**Input**: Design documents from `/specs/004-monitoring-audit/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the initial backend and frontend modules for monitoring, finance, and audit governance.

- [X] T001 [P] Create backend API module stubs in `backend/src/api/v1/finance.py`, `backend/src/api/v1/system_settings.py`, and `backend/src/api/v1/metrics.py`
- [X] T002 [P] Create backend service module stubs in `backend/src/services/finance_service.py`, `backend/src/services/settings_service.py`, and `backend/src/services/monitoring_service.py`
- [X] T003 [P] Create backend data model stubs in `backend/src/models/financial_record.py`, `backend/src/models/system_settings.py`, `backend/src/models/cleanup_job.py`, and `backend/src/models/container_health_metric.py`
- [X] T004 [P] Create frontend page stubs in `frontend/src/pages/financial/AgentCostDetail.tsx`, `frontend/src/pages/monitoring/SystemHealth.tsx`, and `frontend/src/pages/audit/AuditLogPage.tsx`
- [X] T005 [P] Add new frontend service stubs in `frontend/src/services/financeService.ts`, `frontend/src/services/monitoringService.ts`, and `frontend/src/services/auditService.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the shared backend data structures, routing, and authorization that all user stories depend on.

- [X] T006 Extend `backend/src/models/audit.py` to support `target_entity_type`, `target_entity_id`, and `deleted_user_display` fields for deleted-user audit preservation
- [X] T007 Implement relational persistence in `backend/src/models/financial_record.py` for financial records and estimated cost tracking
- [X] T008 Implement relational persistence in `backend/src/models/system_settings.py` for retention and alert configuration
- [X] T009 Implement relational persistence in `backend/src/models/cleanup_job.py` for background cleanup task state and retry tracking
- [X] T010 Implement relational persistence in `backend/src/models/container_health_metric.py` for container disk and memory health history
- [X] T011 Create an Alembic migration file in `backend/alembic/versions/` for the new monitoring/audit schema additions
- [X] T012 Implement system settings read and update operations in `backend/src/services/settings_service.py`
- [X] T013 Implement finance aggregation and token-based cost estimation in `backend/src/services/finance_service.py`
- [X] T014 Implement container health and disk alert logic in `backend/src/services/monitoring_service.py`
- [X] T015 Extend `backend/src/api/auth.py` or existing auth dependencies to ensure Owner/SUPERADMIN access control is available to monitoring and audit endpoints
- [X] T016 Register the new routers in `backend/src/main.py` for finance, system settings, and metrics endpoints
- [X] T017 Update `backend/src/api/v1/audit.py` to support authorization, result ordering, and eventual filtering extension points

---

## Phase 3: User Story 1 - Retenção de Dados de Auditoria e Logs (Priority: P1)

**Goal**: Enable configurable retention policies and TaskIQ cleanup for logs and temporary storage while keeping the chat service responsive.

**Independent Test**: Update retention settings and verify a cleanup TaskIQ job is scheduled and removes entries older than the configured period without blocking chat requests.

- [X] T018 [US1] Implement `GET /v1/system/settings` in `backend/src/api/v1/system_settings.py` to return current retention and alert configuration
- [X] T019 [US1] Implement `PATCH /v1/system/settings` in `backend/src/api/v1/system_settings.py` to update `Retention_Period_Days` and `Storage_Threshold_Alert`
- [X] T020 [US1] Implement a TaskIQ cleanup task in `backend/src/workers/cleanup.py` that removes audit logs and temporary records older than the retention period
- [X] T020A [US1] Define and schedule the daily TaskIQ cleanup job recurrence in `backend/src/workers/cleanup.py` and `backend/src/services/settings_service.py`
- [X] T021 [US1] Implement cleanup job state tracking in `backend/src/models/cleanup_job.py` and persistence updates from `backend/src/workers/cleanup.py`
- [X] T021A [US1] Track consecutive cleanup failures and notify the Dono after 3 failed runs in `backend/src/models/cleanup_job.py` and `backend/src/workers/cleanup.py`
- [X] T022 [US1] Implement disk usage polling and threshold alert generation in `backend/src/workers/container_health.py` for the Docker container
- [X] T023 [US1] Implement `GET /v1/system/metrics` in `backend/src/api/v1/metrics.py` to expose `disk_usage_percent`, `memory_usage_percent`, and available bytes
- [X] T024 [US1] Implement frontend system health and retention settings views in `frontend/src/pages/monitoring/SystemHealth.tsx` and wire them to `frontend/src/services/monitoringService.ts`

---

## Phase 4: User Story 2 - Análise de Custos Granular por Agente (Priority: P2)

**Goal**: Provide finance dashboards that show aggregated spending and detailed agent cost breakdown by skill and token usage.

**Independent Test**: View the financial dashboard, select an agent, and confirm the detail page shows skill-level token counts and estimated cost data.

- [X] T025 [US2] Implement `GET /v1/finance/summary` in `backend/src/api/v1/finance.py` to return total cost, token volume, service breakdown, and daily trend
- [X] T026 [US2] Implement `GET /v1/finance/agent/{agent_id}` in `backend/src/api/v1/finance.py` to return per-agent cost details by skill and type
- [X] T027 [US2] Implement `GET /v1/finance/export` in `backend/src/api/v1/finance.py` to export filtered financial records as CSV
- [X] T028 [US2] Implement frontend finance dashboard and agent detail views in `frontend/src/pages/financial/AgentCostDetail.tsx` and `frontend/src/services/financeService.ts`
- [X] T029 [US2] Implement CSV export integration in `frontend/src/services/financeService.ts` and link it from the finance dashboard UI
- [X] T030 [US2] Wire token-based cost estimation from `backend/router_import.py` pricing rules into `backend/src/services/finance_service.py` for dashboard accuracy

---

## Phase 5: User Story 3 - Auditoria de Ações da Equipe (Priority: P3)

**Goal**: Deliver a chronologically ordered, filterable audit log view that preserves deleted user identities and supports owner review.

**Independent Test**: Filter audit logs by date or user and confirm the returned entries include user name, action, timestamp, and deleted-user display values.

- [X] T031 [US3] Extend `backend/src/api/v1/audit.py` to support query parameters `start_date`, `end_date`, `user_id`, and `action`
- [X] T032 [US3] Implement audit log ordering and pagination in `backend/src/api/v1/audit.py`
- [X] T033 [US3] Implement deleted-user display preservation in `backend/src/models/audit.py` and audit query logic
- [X] T034 [US3] Implement frontend audit log page and filtering UI in `frontend/src/pages/audit/AuditLogPage.tsx` and `frontend/src/services/auditService.ts`
- [X] T035 [US3] Implement deleted-user display preservation and state-empty/error handling in the audit UI for no-results and filter-miss cases

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, documentation, and deployment-ready cleanup.

- [X] T036 [P] Update `backend/src/main.py` route registration and ensure new endpoints are documented in OpenAPI
- [X] T037 [P] Update `specs/004-monitoring-audit/quickstart.md` with the execution steps for new monitoring and audit flows
- [X] T038 [P] Update `specs/004-monitoring-audit/contracts/api-contracts.md` with final endpoint contract details and request/response shapes
- [X] T039 [P] Update `backend/src/services/finance_service.py` and `backend/src/services/settings_service.py` to add logging of critical events for governance auditability
- [X] T040 [P] Review and refactor `backend/src/workers/cleanup.py` and `backend/src/workers/container_health.py` for TaskIQ retry and error reporting behavior
- [X] T041 [P] Confirm all new frontend modules are imported and wired in the application navigation or dashboard routes
- [X] T042 [P] Validate the new feature by following `specs/004-monitoring-audit/quickstart.md` end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Start immediately. All other phases depend on these skeleton modules.
- **Foundational (Phase 2)**: Blocks all user story work until complete.
- **User Story phases**: Can begin in parallel after Foundational is complete, with P1 prioritized first.
- **Polish (Phase 6)**: Depends on all user stories being implemented.

### User Story Dependencies

- **US1**: Depends on foundational backend models, services, and TaskIQ cleanup support.
- **US2**: Depends on foundational finance models, services, and route scaffolding.
- **US3**: Depends on foundational audit model extensions and authorization support.

### Parallel Opportunities

- Setup skeleton files can run in parallel since they create independent modules.
- Model and service implementations in Phase 2 can run in parallel when they do not share direct dependencies.
- User story frontend and backend work can be split across team members after foundational infrastructure is ready.
- Documentation and contract updates in Phase 6 are parallelizable.
