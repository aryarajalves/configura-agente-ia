# Implementation Plan: Monitorização e Auditoria (Módulo 4)

**Branch**: `004-monitoring-audit` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-monitoring-audit/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Este módulo implementa a camada de governança do FluxAI, proveniente do backend e da interface administrativa. Ele cobre:
- políticas de retenção configuráveis para logs de auditoria e arquivos temporários;
- análise granular de custo por agente e habilidade baseada em estimativas de token;
- trilha de auditoria cronológica de alterações de configuração;
- monitoramento de uso de disco e memória do contêiner Docker.

A solução reutiliza os padrões existentes do repositório: FastAPI assíncrono, PostgreSQL, TaskIQ para jobs de limpeza e monitoramento, e um modelo de audit log já presente em `backend/src/models/audit.py`.

## Technical Context

**Language/Version**: Python 3.12+ (Async)  
**Primary Dependencies**: FastAPI, SQLAlchemy (Async), TaskIQ, RabbitMQ, Pydantic v2, PostgreSQL  
**Storage**: PostgreSQL relacional + filesystem/cgroup metrics para monitoramento de contêiner  
**Testing**: pytest + pytest-asyncio  
**Target Platform**: Linux / Docker (On-premise)  
**Project Type**: Web Service / Governance Dashboard  
**Performance Goals**:
- manter o chat responsivo durante a execução de limpeza de retenção;
- garantir alertas de disco antes de 90% de ocupação;
- fornecer relatórios financeiros com precisão interna de custo inferior a 1%.
**Constraints**:
- todas as tarefas long-running devem usar TaskIQ;
- não bloquear requisições HTTP de usuário;
- seguir a arquitetura de backend `backend/src/api/v1/`, `backend/src/models/`, `backend/src/services/`, `backend/src/workers/`.
**Scale/Scope**: implantação local em contêiner Docker para uma única instalação de cliente, com dados de auditoria e finanças para múltiplos agentes internos.

## Constitution Check

*GATE: Passed on 2026-04-08. A solução respeita as restrições de arquitetura e processamento.*

| Principle | Status | Observation |
|-----------|---|---|
| **I. Canonical Stack** | ✅ Pass | FastAPI, SQLAlchemy, TaskIQ, RabbitMQ e PostgreSQL. |
| **III. Data Integrity** | ✅ Pass | Audit log e configurações persistentes com histórico; novo modelo financeiro é relacional. |
| **IV. Performance** | ✅ Pass | Limpeza e cálculos de custo são background via TaskIQ. |
| **V. Security** | ✅ Pass | Acesso a auditoria e configurações restrito a Owner/SUPERADMIN. |
| **VI. Observability** | ✅ Pass | Métricas de contêiner e histórico de tarefas de limpeza serão expostos e auditáveis. |

## Project Structure

### Documentation (this feature)

```text
specs/004-monitoring-audit/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-contracts.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/v1/
│   │   ├── audit.py
│   │   ├── finance.py
│   │   ├── system_settings.py
│   │   └── metrics.py
│   ├── models/
│   │   ├── audit.py
│   │   ├── financial_record.py
│   │   ├── system_settings.py
│   │   ├── cleanup_job.py
│   │   └── container_health_metric.py
│   ├── services/
│   │   ├── audit_service.py
│   │   ├── finance_service.py
│   │   ├── settings_service.py
│   │   └── monitoring_service.py
│   └── workers/
│       ├── cleanup.py
│       └── container_health.py
└── tests/
    ├── integration/
    └── unit/
frontend/
├── src/
│   ├── pages/
│   │   ├── monitoring/
│   │   ├── financial/
│   │   └── audit/
│   └── services/
└── tests/
```

**Structure Decision**: Option 2 (Monorepo Web App). O feature é uma extensão do backend administrativo e das páginas de dashboard existentes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Extending existing audit model | Reuse de lógica e consistência com `backend/src/models/audit.py` | Criar tabela paralela aumentaria duplicação e complicaria consultas de auditoria. |
