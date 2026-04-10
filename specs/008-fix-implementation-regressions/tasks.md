# Tasks: Correção de Regressões e Estabilidade

**Input**: Design documents from `/specs/008-fix-implementation-regressions/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Infraestrutura básica e ajustes de ambiente.

- [x] T001 Atualizar imagem do RabbitMQ no `infra/docker-compose-local.yml` para herdar do backend `${IMAGE_BASE}-backend`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reversão estrutural de nomenclatura no backend (Skills -> KnowledgeBase).

- [x] T002 Renomear `backend/src/models/skill.py` para `backend/src/models/knowledge_base.py` e atualizar classe/tabela.
- [x] T003 [P] Renomear `backend/src/services/skill_service.py` para `backend/src/services/knowledge_base_service.py` e atualizar referências.
- [x] T004 [P] Renomear `backend/src/services/skill_version_service.py` para `backend/src/services/knowledge_base_version_service.py`.
- [x] T005 [P] Criar Migration Alembic para renomear tabelas `skills` -> `knowledge_bases`, `skill_versions` -> `knowledge_base_versions` e IDs relacionados.
- [x] T006 Atualizar imports em todo o diretório `backend/src/` para refletir os novos nomes de modelos e serviços.

**Checkpoint**: Estrutura de dados revertida para "KnowledgeBase". Pronto para as User Stories.

---

## Phase 3: User Story 1 - Terminologia e Navegação (Priority: P1) 🎯 MVP

**Goal**: Restaurar nomes consistentes na interface e garantindo navegação funcional.

**Independent Test**: Conferir se a sidebar exibe "Bases de Conhecimento" e redireciona para `/knowledge-bases` funcional.

### Implementation for User Story 1

- [x] T007 [P] [US1] Atualizar `frontend/src/components/Sidebar.jsx` para renomear "Skills (Bases)" para "Bases de Conhecimento" e ajustar link para `/knowledge-bases`.
- [x] T008 [P] [US1] Renomear roteador `backend/src/api/v1/skills.py` para `backend/src/api/v1/knowledge_bases.py` e ajustar prefixo.
- [x] T009 [US1] Restaurar endpoint `GET /v1/knowledge-bases` com suporte a listagem em `backend/src/api/v1/knowledge_bases.py`.
- [x] T010 [US1] Substituir rótulo "Teste de Estresse" por "Fine-Tuning" em `frontend/src/components/Sidebar.jsx` e apontar para `/fine-tuning`.
- [x] T011 [P] [US1] Remover item "Inbox (Falhas)" da sidebar em `frontend/src/components/Sidebar.jsx`.

---

## Phase 4: User Story 2 - Estabilidade na Criação de Agentes (Priority: P1) 🎯 MVP

**Goal**: Corrigir erros de validação e runtime na criação e configuração de agentes.

**Independent Test**: Criar um novo agente e acessar a aba "Habilidades" sem erros no console.

### Implementation for User Story 2

- [x] T012 [US2] Corrigir validação de campos obrigatórios em `backend/src/api/v1/agents.py` para evitar erro 422 silencioso.
- [x] T013 [P] [US2] Criar `backend/src/api/v1/models.py` para restaurar endpoint `GET /v1/models`.
- [x] T014 [P] [US2] Criar `backend/src/api/v1/tools.py` para restaurar endpoint `GET /v1/tools`.
- [x] T015 [US2] Implementar fallbacks `[]` em `frontend/src/components/ConfigPanel.jsx` para evitar `TypeError: filter is not a function`.

---

## Phase 5: User Story 3 - Integridade dos Módulos (Financeiro/Usuários) (Priority: P2)

**Goal**: Restaurar acesso aos módulos de gestão com dados consistentes.

**Independent Test**: Acessar `/financeiro` e `/users` e ver listas renderizadas em vez de erros.

### Implementation for User Story 3

- [x] T016 [US3] Criar `backend/src/api/v1/users.py` para restaurar endpoint `GET /v1/users` (listagem de administradores).
- [x] T017 [P] [US3] Adicionar rota `GET /v1/financial/report` em `backend/src/api/v1/finance.py` como alias para summary.
- [x] T018 [US3] Adicionar verificações de nulidade e fallbacks `[]` em `frontend/src/pages/Financeiro.jsx`.
- [x] T019 [P] [US3] Adicionar verificações de nulidade e fallbacks `[]` em `frontend/src/pages/UserManagement.jsx`.

---

## Phase 6: User Story 4 - Persistência de Sessão (Priority: P2)

**Goal**: Garantir login contínuo via Cookies persistentes.

**Independent Test**: Permanecer logado após refresh ou tempo de inatividade prolongado.

### Implementation for User Story 4

- [x] T020 [US4] Atualizar `backend/src/services/auth_service.py` para suportar emissão de tokens/cookies persistentes (long-lived).
- [x] T021 [US4] Ajustar lógica de login em `backend/src/api/v1/auth.py` para setar cookies com `HttpOnly=True` e sem expiração curta.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T022 [P] Atualizar `README.md` com a nova (velha) nomenclatura de Knowledge Base.
- [x] T023 Validar todos os fluxos usando o guia em `quickstart.md`.
- [x] T024 Remover arquivos residuais e scripts de debug não utilizados no backend.

---

## Dependencies & Execution Order

1. **Phase 1 & 2** devem ser concluídas primeiro (Base para tudo).
2. **US1 e US2** podem ser executadas em paralelo após a Phase 2 (Ambas P1).
3. **US3 e US4** podem ser executadas em paralelo por último.
 de API)
- T017, T019 (Ajustes de módulos de gestão)
