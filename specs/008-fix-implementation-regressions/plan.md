# Implementation Plan: Correção de Erros de Implementação e Regressões de UI

**Branch**: `008-fix-implementation-regressions` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-fix-implementation-regressions/spec.md`

## Summary
Este plano visa estabilizar a plataforma Aryaraj corrigindo regressões introduzidas em refatorações anteriores. O foco principal é a restauração da nomenclatura "Bases de Conhecimento" (revertendo "Skills") em todas as camadas (DB, Backend, Frontend), a restauração de rotas de API essenciais que estão retornando 404, a implementação de persistência de sessão via cookies e a correção de erros de UI que impedem a criação de agentes e visualização de módulos.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript/React (Vite)  
**Primary Dependencies**: FastAPI, SQLAlchemy, Alembic, React, TaskIQ, RabbitMQ  
**Storage**: PostgreSQL + pgvector  
**Testing**: pytest  
**Target Platform**: Linux server (Docker On-premise)
**Project Type**: web-service / web-app  
**Performance Goals**: N/A (Estabilização de bugs existentes)  
**Constraints**: Reversão física de banco de dados, persistência de autenticação sem expiração via Cookies.  
**Scale/Scope**: Sistema de governança de agentes de IA.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Tech Stack)**: Pass. O plano utiliza FastAPI, React e SQLAlchemy conforme exigido.
- **Principle III (Data Integrity)**: Pass. Todas as mudanças de esquema serão via migrations Alembic. Reversão de "Skills" para "KnowledgeBase" segue o ID compartilhado RAG.
- **Principle V (Security)**: Pass. Autenticação via JWT mantida, mas ajustada para persistência em Cookies conforme solicitado pelo usuário.
- **Principle VIII (UX Integrity)**: Pass. Correção de indicadores de erro no frontend para evitar quebra de componentes.

## Project Structure

### Documentation (this feature)

```text
specs/008-fix-implementation-regressions/
├── plan.md              # This file
├── research.md          # Resultados da análise de rotas e DB
├── data-model.md        # Esquema de reversão para KnowledgeBase
├── quickstart.md        # Guia de validação das correções
├── contracts/           
│   └── restored_apis.md # Contratos das rotas /v1/models, /v1/users, etc.
└── tasks.md             # (Gerado em seguida via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/src/
├── models/
│   ├── knowledge_base.py (Renomeado de skill.py)
│   └── ...
├── services/
│   ├── knowledge_base_service.py (Renomeado de skill_service.py)
│   └── auth_service.py (Ajustado para Cookies persistentes)
├── api/v1/
│   ├── agents.py (Fix validation)
│   ├── knowledge_bases.py (Restauração de rota)
│   ├── models.py (Nova rota restaurada)
│   ├── tools.py (Nova rota restaurada)
│   └── ...
└── migrations/ (Novas migrations de renomeação)

frontend/src/
├── components/
│   ├── Sidebar.jsx (Correção de nomes e links)
│   └── ConfigPanel.jsx (Fix TypeError em kbList.filter)
├── pages/
│   ├── Financeiro.jsx (Fix forEach of undefined)
│   └── UserManagement.jsx (Fix users.filter error)
└── services/ (Ajuste de persistência de token)
```

**Structure Decision**: Segue a estrutura de monorepo existente com separação de frontend e backend em `backend/src` e `frontend/src`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Renomeação Física de DB | Integridade técnica solicitada | Mapeamento apenas em código geraria dívida técnica entre DB e Model. |
| Restauração de Endpoints | Compatibilidade com Frontend Legado | Refatorar todo o frontend para novas rotas seria mais arriscado e demorado. |
