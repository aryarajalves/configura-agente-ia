# Tasks: Correção de INFRA e Regressões (FluxAI)

**Input**: Design documents from `/specs/008-fix-implementation-regressions/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

## Phase 1: Setup (Infraestrutura e Deploy)

**Purpose**: Orquestração Docker e infraestrutura básica local.

- [ ] T001 [P] Criar Dockerfile customizado para RabbitMQ em `backend/rabbitmq.Dockerfile`
- [ ] T002 [P] Atualizar `infra/docker-compose-local.yml` para incluir `include: - docker-compose-db-local.yml`
- [ ] T003 Atualizar serviço `rabbitmq` em `infra/docker-compose-local.yml` para usar `build` do context `../backend`
- [ ] T004 [P] Ajustar rede `network_swarm_public` em `infra/docker-compose-local.yml` e `infra/docker-compose-db-local.yml` para bridge interna (remover `external: true`)
- [ ] T005 [P] Adicionar dependência `depends_on: postgres` (condition: healthy) no backend em `infra/docker-compose-local.yml`
- [ ] T006 [P] Descomentar e ajustar `VITE_API_URL` para `http://localhost:8000` no frontend service em `infra/docker-compose-local.yml`

---

## Phase 2: Foundational (Capa de Dados Knowledge Base)

**Purpose**: Estabilização da nomenclatura técnica e estrutura de dados.

- [ ] T007 Executar script de migração para garantir que tabelas `knowledge_bases` e `knowledge_base_versions` existam fisicamente
- [ ] T008 [P] Validar se todos os controllers em `backend/src/api/v1/` importam `KnowledgeBaseService` em vez de `SkillService`
- [ ] T009 [P] Validar integridade das models em `backend/src/models/knowledge_base.py`

---

## Phase 3: User Story 1 - Terminologia e Sidebar (Priority: P1)

**Goal**: Interface consistente com "Bases de Conhecimento" e links corrigidos.

- [ ] T010 [P] [US1] Atualizar `frontend/src/components/Sidebar.jsx` para renomear "Skills (Bases)" para "Bases de Conhecimento" e ajustar link para `/knowledge-bases`
- [ ] T011 [P] [US1] Mover "Inbox (Falhas)" da sidebar global para dentro da página de Bases de Conhecimento
- [ ] T012 [P] [US1] Renomear rótulo "Teste de Estresse" por "Fine-Tuning" em `frontend/src/components/Sidebar.jsx` apontando para `/fine-tuning`

---

## Phase 4: User Story 2 - Estabilidade na Criação de Agentes (Priority: P1)

**Goal**: Eliminar erros 422/404 na configuração de novos agentes.

- [ ] T013 [US2] Implementar validação de campos obrigatórios em `backend/src/api/v1/agents.py` para evitar falhas silenciosas
- [ ] T014 [P] [US2] Restaurar endpoints `GET /v1/models` em `backend/src/api/v1/models.py`
- [ ] T015 [P] [US2] Restaurar endpoints `GET /v1/tools` em `backend/src/api/v1/tools.py`
- [ ] T016 [US2] Adicionar fallbacks `[]` em `frontend/src/components/ConfigPanel.jsx` para tratar listas vazias de ferramentas/habilidades

---

## Phase 5: User Story 3 - Módulos Financeiro e Usuários (Priority: P2)

**Goal**: Garantir que as listas de usuários e relatórios financeiros carreguem sem erros de runtime.

- [ ] T017 [US3] Implementar endpoint `GET /v1/users` em `backend/src/api/v1/users.py` para listagem de admins
- [ ] T018 [P] [US3] Garantir que `backend/src/api/v1/finance.py` responda em `/v1/financial/report`
- [ ] T019 [US3] Corrigir erro de renderização `forEach of undefined` em `frontend/src/pages/Financeiro.jsx` via verificações de nulidade
- [ ] T020 [P] [US3] Corrigir erro `users.filter is not a function` em `frontend/src/pages/UserManagement.jsx` via fallbacks de array

---

## Phase 6: User Story 4 - Persistência de Sessão (Priority: P2)

**Goal**: Manter o usuário logado via cookies persistentes.

- [ ] T021 [US4] Configurar `HttpOnly` cookies e tempo de expiração estendido em `backend/src/services/auth_service.py`
- [ ] T022 [US4] Ajustar endpoint de login em `backend/src/api/v1/auth.py` para emitir os cookies de sessão contínua

---

## Phase 7: Polish & Validação Geral

- [ ] T023 Executar smoke test completo seguindo o `quickstart.md`
- [ ] T024 Validar critério SC-002: Zero erros detectados no console durante a navegação entre todos os módulos
- [ ] T025 [P] Atualizar documentação local para refletir a nova orquestração Docker
