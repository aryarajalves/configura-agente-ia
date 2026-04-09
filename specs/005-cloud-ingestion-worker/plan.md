# Implementation Plan: Ingestão de Dados & Gestão de Nuvem (Backblaze)

**Branch**: `005-cloud-ingestion-worker` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-cloud-ingestion-worker/spec.md`

## Summary

Este projeto implementa o módulo de ingestão assíncrona de arquivos para a base RAG. O fluxo consiste em receber o arquivo via API, delegar o upload para o Backblaze B2 via **TaskIQ**, monitorar o progresso via **WebSockets**, realizar a vetorização/IA (limitada a 1 execução simultânea) e confirmar a deleção do arquivo temporário na nuvem após o sucesso.

## Technical Context

**Language/Version**: Python 3.12 (Autoridade: Constitution V2)
**Primary Dependencies**: FastAPI, TaskIQ, RabbitMQ, b2sdk, Pydantic v2
**Storage**: PostgreSQL (pgvector), Backblaze B2 (Bucket Privado)
**Testing**: pytest
**Target Platform**: Linux server (On-premise Docker)
**Project Type**: Web Service (Backend)
**Performance Goals**: Tempo de resposta da UI < 1s; Suporte a arquivos de até 2GB.
**Constraints**: Processamento de IA limitado a 1 worker simultâneo; Verificação de duplicata via SHA256.
**Scale/Scope**: Módulo central de conhecimento para o agente.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Canonical Tech Stack**: Uso de TaskIQ + RabbitMQ para background tasks e Backblaze B2 para storage. Conforme.
- [x] **III. Data Integrity**: Registro de `IngestionTask` com soft delete e hash único para sincronia. Conforme.
- [x] **IV. Performance**: Offloading total para TaskIQ e uso de filas segregadas para IA. Conforme.
- [x] **V. Security**: Backblaze B2 configurado como bucket privado com acesso restrito via credenciais de API. Conforme.
- [x] **VIII. UX Integrity**: WebSockets definidos para progresso em tempo real e logs detalhados para auditoria. Conforme.

## Project Structure

### Documentation (this feature)

```text
specs/005-cloud-ingestion-worker/
├── plan.md              # Este documento
├── research.md          # Pesquisa técnica (B2 SDK, TaskIQ Concurrency)
├── data-model.md        # Entidade IngestionTask e transições de estado
├── quickstart.md        # Guia de configuração e teste
├── contracts/           
│   └── api-contracts.md # Endpoints de upload e WebSocket
└── tasks.md             # Planejado para a próxima fase
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   └── ingestion.py      # SQLAlchemy model para IngestionTask
│   ├── services/
│   │   ├── cloud_service.py   # Interface com Backblaze B2
│   │   └── ingestion_service.py # Orquestração e lógica de hash
│   ├── tkq/
│   │   └── tasks.py          # Workers TaskIQ para upload e processamento
│   └── api/
│       ├── v1/
│       │   └── endpoints/    # Upload e Status
│       └── ws/               # WebSocket handler para progresso
└── tests/
    ├── integration/
    └── unit/
```

**Structure Decision**: Web application structure detected (Monorepo). As per the Constitution, the features are divided into `backend/` and `frontend/`. This plan focuses on the backend implementation of the worker and services.
