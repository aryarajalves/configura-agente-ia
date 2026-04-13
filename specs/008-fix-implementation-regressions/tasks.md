# Tasks: Correção de INFRA e Regressões (FluxAI)

**Input**: Design documents from `/specs/008-fix-implementation-regressions/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

## Phase 1: Setup (Infraestrutura e Deploy)

**Purpose**: Orquestração Docker e infraestrutura básica local.

- [x] T001 [P] Criar Dockerfile customizado para RabbitMQ em `backend/rabbitmq.Dockerfile`
- [x] T002 [P] Atualizar `infra/docker-compose-local.yml` para incluir `include: - docker-compose-db-local.yml`
- [x] T003 Atualizar serviço `rabbitmq` em `infra/docker-compose-local.yml` para usar `build` do context `../backend`
- [x] T004 [P] Ajustar rede `network_swarm_public` em `infra/docker-compose-local.yml` e `infra/docker-compose-db-local.yml` para bridge interna (remover `external: true`)
- [x] T005 [P] Adicionar dependência `depends_on: postgres` (condition: healthy) nel backend em `infra/docker-compose-local.yml`
- [x] T006 [P] Descomentar e ajustar `VITE_API_URL` para `http://localhost:8000` no frontend service em `infra/docker-compose-local.yml`

---

## Phase 2: Foundational (Capa de Dados Knowledge Base)

**Purpose**: Estabilização da nomenclatura técnica e estrutura de dados.

- [x] T007 Executar script de migração para garantir que tabelas `knowledge_bases` e `knowledge_base_versions` existam fisicamente.
- [x] T008 [P] Validar se todos os controllers em `backend/src/api/v1/` importam `KnowledgeBaseService` em vez de `SkillService`.
- [x] T009 [P] Validar integridade das models em `backend/src/models/knowledge_base.py`. Refatorado imports de `src.models.skill` para `knowledge_base` em todo o backend.

---

## Phase 3: User Story 1 - Terminologia e Sidebar (Priority: P1)

**Goal**: Interface consistente com "Bases de Conhecimento" e links corrigidos.

- [x] T010 [P] [US1] Atualizar `frontend/src/components/Sidebar.jsx` para renomear "Skills (Bases)" para "Bases de Conhecimento".
- [x] T011 [P] [US1] Mover "Inbox (Falhas)" da sidebar global para dentro da página de Bases de Conhecimento.
- [x] T012 [P] [US1] Renomear rótulo "Teste de Estresse" por "Fine-Tuning" em `frontend/src/components/Sidebar.jsx` apontando para `/fine-tuning`.

---

## Phase 4: User Story 2 - Estabilidade na Criação de Agentes (Priority: P1)

**Goal**: Eliminar erros 422/404 na configuração de novos agentes.

- [x] T013 [US2] Implementar validação de campos obrigatórios em `backend/src/api/v1/agents.py`.
- [x] T014 [P] [US2] Restaurar endpoints `GET /v1/models` em `backend/src/api/v1/models.py`.
- [x] T015 [P] [US2] Restaurar endpoints `GET /v1/tools` em `backend/src/api/v1/tools.py`.
- [x] T016 [US2] Adicionar fallbacks `[]` em `frontend/src/components/ConfigPanel.jsx`.
- [x] T016b Flattening de `rules_config` no backend para garantir exibição correta no frontend.

---

## Phase 5: User Story 3 - Módulos Financeiro e Usuários (Priority: P2)

**Goal**: Garantir que as listas de usuários e relatórios financeiros carreguem sem erros de runtime.

- [x] T017 [US3] Implementar endpoint `GET /v1/users` em `backend/src/api/v1/users.py` para listagem de admins.
- [x] T018 [P] [US3] Garantir que `backend/src/api/v1/financial_report.py` responda em `/v1/financial/report`.
- [x] T019 [US3] Corrigir erro de renderização `forEach of undefined` em `frontend/src/pages/Financeiro.jsx`.
- [x] T020 [P] [US3] Corrigir erro `users.filter is not a function` em `frontend/src/pages/UserManagement.jsx`.

---

## Phase 6: User Story 4 - Persistência de Sessão (Priority: P2)

**Goal**: Manter o usuário logado via cookies persistentes.

- [x] T021 [US4] Configurar `HttpOnly` cookies em `backend/src/api/v1/auth.py`.
- [x] T022 [US4] Ajustar endpoint de login para emitir os cookies de sessão contínua.

---

## Phase 7: Polish & Validação Geral

- [x] T023 Consolidar migrações Alembic e limpar tabelas legadas (`skills`).
- [x] T024 Sincronizar endpoints frontend `/skills` -> `/knowledge-bases`.
- [ ] T025 Executar smoke test final.
