# Implementation Plan: Motor FluxAI (Módulo 1)

**Branch**: `001-fluxai-core-engine` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-fluxai-core-engine/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

O Motor FluxAI é o núcleo de inteligência da plataforma, implementando uma arquitetura de "Dois Cérebros" (Rápido e Analítico) orquestrada via **LangGraph**. O sistema gerencia o ciclo de vida dos agentes (Ativo, Inativo, Rascunho) e aplica governança de permissões onde o **SUPERADMIN** atua como o proprietário (Dono) dos agentes que cria, possuindo controle total e acesso global a logs. Adicionalmente, implementa uma camada de segurança pós-processamento (Guardlines/Double Check). O approach técnico utiliza **FastAPI assíncrono**, **PostgreSQL** e **TaskIQ**.

## Technical Context

**Language/Version**: Python 3.12+ (Async)
**Primary Dependencies**: FastAPI, SQLAlchemy (Async), LangGraph, TaskIQ, RabbitMQ, Pydantic v2, pgvector.
**Storage**: PostgreSQL (Relational) + pgvector (Semantic)
**Testing**: pytest + pytest-asyncio
**Target Platform**: Linux / Docker (On-premise)
**Project Type**: AI Orchestration Engine (Web Service)
**Performance Goals**: SLA de 10s para respostas normais; teto de 20s para fallback; detecção de loop em até 3 repetições.
**Constraints**: 
- **DONE**: Pesquisa técnica sobre roteamento LangGraph (Classifier-Router).
- **DONE**: Estrutura de Audit Log para conformidade.
- **DONE**: Gestão de estado com PostgresSaver.

## Constitution Check

*GATE: Passed on 2026-04-08. Post-design terminology update complete.*

| Principle | Status | Observation |
|-----------|---|---|
| **I. Canonical Stack** | ✅ Pass | TaskIQ + RabbitMQ. |
| **III. Data Integrity** | ✅ Pass | Shared IDs e Soft Delete (superadmin_id como dono). |
| **V. Security** | ✅ Pass | Consolidação de papéis: SUPERADMIN é o proprietário e supervisor global. |
| **VII. AI Discipline** | ✅ Pass | Dual-model pair e Roteamento Híbrido. |

## Project Structure

### Documentation (this feature)

```text
specs/001-fluxai-core-engine/
├── plan.md              # This file
├── research.md          # Research (langgraph, audit log)
├── data-model.md        # Updated model (superadmin_id)
├── quickstart.md        # Setup guide
├── contracts/
│   └── openapi.yml      # Updated contracts (SUPERADMIN)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── alembic/
├── src/
│   ├── api/v1/
│   │   ├── agents.py
│   │   └── sessions.py
│   ├── models/
│   │   ├── agent.py (superadmin_id)
│   │   └── audit.py
│   ├── services/
│   │   ├── agent_service.py
│   │   ├── orchestrator_service.py
│   │   └── security_service.py
│   └── workers/
└── tests/

frontend/
├── src/
│   ├── pages/ (SUPERADMIN dashboard)
│   └── services/
```

**Structure Decision**: Option 2 (Monorepo Web App). O SUPERADMIN gerencia agentes via interface administrativa e acessa logs globais.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| LangGraph Statefulness | Detecção de loops (US05). | Stateless impediria detecção resiliente. |
| Unificação SUPERADMIN | Simplificar governança conforme decisão de design. | Manter papéis separados aumentaria complexidade de permissões desnecessariamente. |
