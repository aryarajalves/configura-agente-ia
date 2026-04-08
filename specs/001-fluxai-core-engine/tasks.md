# Tasks: Motor FluxAI Core Engine

**Input**: Design documents from `/specs/001-fluxai-core-engine/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in TDD format, so implementation focuses on verifyable functional units per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

- **Project Structure**: Web application monorepo
  - **Backend**: `backend/src/`
  - **Models**: `backend/src/models/`
  - **Services**: `backend/src/services/`
  - **Endpoints**: `backend/src/api/v1/`
  - **Workers**: `backend/src/workers/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure (backend/frontend folders) per implementation plan
- [x] T002 Initialize Python 3.12 project with FastAPI, SQLAlchemy, and Pydantic v2 in backend/
- [x] T003 Initialize TaskIQ with RabbitMQ broker config in backend/src/workers/broker.py
- [x] T004 [P] Configure linting (ruff/flake8) and formatting (black) in backend/pyproject.toml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure for database, auth, and base orchestration

- [x] T005 Setup PostgreSQL + Alembic migration framework in backend/alembic/
- [x] T006 Create base Admin model with SUPERADMIN and ADMIN roles in backend/src/models/admin.py
- [x] T007 [P] Implement JWT authentication middleware for SUPERADMIN access in backend/src/api/auth.py
- [x] T008 [P] Initialize LangGraph base state management and PostgresSaver integration in backend/src/services/orchestrator_service.py
- [x] T009 Create Pydantic schemas for generic API error envelopes in backend/src/models/schemas.py

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Configuração de Modelos Híbridos (Priority: P1) 🎯 MVP

**Goal**: Permitir que um SUPERADMIN configure modelos Rápido e Analítico para um agente e realize o roteamento básico.

**Independent Test**: Criar um agente via API e verificar se o orquestrador escolhe o nó de roteamento correto com base na configuração.

### Implementation for User Story 1

- [x] T010 [P] [US1] Create Agent model with status (FR-015), model_fast_id and model_analytic_id in backend/src/models/agent.py
- [x] T011 [US1] Implement Agent CRUD (Create/Read) in backend/src/services/agent_service.py
- [x] T012 [P] [US1] Implement Agent endpoints (POST/GET) in backend/src/api/v1/agents.py
- [x] T013 [US1] Implement Classifier-Router logic with Active status check (FR-016) in backend/src/services/orchestrator_service.py
- [x] T014 [US1] Implement dual-brain nodes (FastBrain/AnalyticBrain) in backend/src/services/orchestrator_service.py
- [x] T015 [US1] Create Chat endpoint for initial interaction testing in backend/src/api/v1/chat.py

**Checkpoint**: User Story 1 (MVP) functional: Agentes configuráveis e roteamento básico ativo.

---

## Phase 4: User Story 2 - Gestão de Permissões e Bloqueio (Priority: P2)

**Goal**: Garantir que o SUPERADMIN criador tenha controle exclusivo e log de auditoria de alterações.

**Independent Test**: Tentar editar um agente bloqueado com um Admin comum e verificar o erro 403; conferir se a alteração do SUPERADMIN gerou log.

### Implementation for User Story 2

- [x] T016 [US2] Add is_locked and superadmin_id fields to Agent model in backend/src/models/agent.py
- [x] T017 [US2] Implement global edit lock logic in backend/src/services/agent_service.py
- [x] T018 [P] [US2] Create AuditLog model in backend/src/models/audit.py
- [x] T019 [US2] Integrate audit logging in AgentService for config mutations in backend/src/services/agent_service.py
- [x] T020 [US2] Implement Audit Log retrieval endpoint (restricted to SUPERADMIN) in backend/src/api/v1/audit.py

---

## Phase 5: User Story 3 - Governança e Guardlines (Priority: P2)

**Goal**: Aplicar filtros de segurança (Blacklist) e Double Check por IA pós-geração.

**Independent Test**: Configurar um termo proibido e verificar se a resposta é substituída pela mensagem padrão "Desculpe, não posso ajudar...".

### Implementation for User Story 3

- [x] T021 [US3] Add rules_config (JSONB) to Agent model for Blacklist storage in backend/src/models/agent.py
- [x] T022 [P] [US3] Implement SecurityService with content filtering logic in backend/src/services/security_service.py
- [x] T023 [US3] Implement Double Check IA node in LangGraph flow in backend/src/services/orchestrator_service.py
- [x] T024 [US3] Integrate SecurityService in the LangGraph post-processing edge in backend/src/services/orchestrator_service.py

---

## Phase 6: User Story 4 - Fallback Automático (Priority: P3)

**Goal**: Acionar o modelo de fallback caso o principal falhe ou exceda 8 segundos.

**Independent Test**: Simular timeout do modelo principal e verificar se a resposta é entregue pelo modelo de fallback.

### Implementation for User Story 4

- [x] T025 [US4] Add model_fallback_id to Agent model in backend/src/models/agent.py
- [x] T026 [US4] Implement 8s timeout logic and exception handling for Fallback in backend/src/services/orchestrator_service.py
- [x] T027 [US4] Update Chat analytics to log which model (Main or Fallback) responded.

---

## Phase 7: User Story 5 - Vigilância de Sessão Contra Loops (Priority: P3)

**Goal**: Detectar e mitigar repetições ou loops na conversa do usuário.

**Independent Test**: Enviar a mesma mensagem 3 vezes e verificar se o sistema altera a resposta para mitigar o loop.

### Implementation for User Story 5

- [x] T028 [US5] Add loop_counter to AgentState in backend/src/services/orchestrator_service.py
- [x] T029 [US5] Implement loop verification logic in routers to prevent infinite cycles (Max 3 loops).
- [x] T030 [US5] Implement LoopMitigation node with alternative strategy responses.

---

## Phase 8: Test Infrastructure Update & Validation

**Goal**: Garantir que a suíte de testes valide 100% das novas regras de negócio e segurança.

- [ ] T035 [US1] Refatorar `test_agents.py` para validar campos de Dois Cérebros (Fast/Analytic) e status tripartido (Ativo/Inativo/Rascunho).
- [ ] T036 [US2] Criar `test_governance.py` para validar a Trava Global de Edição (403 para Admin comum) e geração de Logs de Auditoria.
- [ ] T037 [US3] Atualizar `test_verify_output_safety` em `test_agent_core.py` com a mensagem oficial e validar o nó de "Double Check por IA".
- [ ] T038 [US5] Criar `test_loop_detection.py` para validar o contador e a mitigação de loops de mensagens em sessões.
- [ ] T039 [US1] Criar `test_operational_status.py` para garantir que agentes em status "Inativo" ou "Rascunho" bloqueiem mensagens (FR-016).

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final touches and quality assurance

- [x] T031 Implement soft-delete (deleted_at) cleanup worker in backend/src/workers/cleanup.py
- [x] T032 [Polish] Verify all functional requirements (FR-001 to FR-016) against implementation.
- [x] T033 [Polish] Add docstrings to all new services and endpoints.
- [ ] T040 Run full end-to-end smoke test using Quickstart instructions from ./testes/

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)** → **Foundational (Phase 2)**.
2. **Foundational (Phase 2)** (BLOCKS ALL STORIES).
3. **User Story 1 (P1)**: Prerequisite for logic refinement in other stories.
4. **User Story 2 & 3 (P2)** can run in parallel after US1.
5. **User Story 4 & 5 (P3)** for final engine resilience.

### Parallel Opportunities

- **T003 (TaskIQ)** and **T004 (Linting)**.
- **T007 (Auth)** and **T008 (LangGraph Init)**.
- **T012 (Endpoints)** and **T010 (Model expansion)**.
- **T018 (Audit Model)** and **T022 (Security logic)**.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational.
2. Complete US1.
3. Test independent routing (Fast vs Complex).

### Incremental Delivery

Definir o SUPERADMIN como o centro da governança desde a US1 garante que o escalonamento para US2 (Bloqueio) e US3 (Segurança) seja natural e herde as mesmas políticas de acesso.
