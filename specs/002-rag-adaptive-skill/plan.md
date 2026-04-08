# Implementation Plan: RAG Adaptativo & Biblioteca de Habilidades

**Branch**: `002-rag-adaptive-skill` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-rag-adaptive-skill/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This feature adds a decoupled hybrid skill layer to the FluxAI platform, enabling document-based semantic retrieval to be joined with volatile Postgres product data via a shared `product_id`. It introduces a versioned skill pipeline where hybrid skills ingest PDF/TXT/Excel/CSV/audio-video sources through TaskIQ, store vector chunks with `product_id` metadata in `pgvector`, and deliver hybrid responses that combine RAG context with live relational `price`/`stock` data.

## Technical Context

**Language/Version**: Python 3.12+ (Async)
**Primary Dependencies**: FastAPI, SQLAlchemy (Async), pgvector, TaskIQ, RabbitMQ, Pydantic v2, LangGraph
**Storage**: PostgreSQL (Relational) + pgvector (Semantic)
**Testing**: pytest + pytest-asyncio
**Target Platform**: Linux / Docker / On-premise deployment
**Project Type**: Web service / AI orchestration feature
**Performance Goals**: Version switch under 2 seconds; stable hybrid retrieval latency; reliable retry semantics for ingestion failures
**Constraints**: TaskIQ for heavy background jobs; no Celery or synchronous long-running ingestion; all data schema changes must ship with Alembic migrations
**Scale/Scope**: Moderate hybrid skill usage for product-related documents and relational lookups; does not aim for full enterprise knowledge graph governance in this phase

## Constitution Check

*GATE: Passed on 2026-04-08. Feature aligns with the FluxAI constitution.*

| Principle | Status | Observation |
|---|---|---|
| **I. Canonical Stack** | ✅ Pass | Uses FastAPI, PostgreSQL, pgvector, TaskIQ, RabbitMQ in line with constitution. |
| **II. Service Layer** | ✅ Pass | Hybrid skill behavior will live in service layer; agents remain thin. |
| **III. Data Integrity** | ✅ Pass | Unified `product_id` metadata and versioned skill snapshots maintain relational-sync integrity. |
| **IV. Performance & Resilience** | ✅ Pass | Background ingestion, retry semantics, and stable version fallback satisfy constitution requirements. |
| **V. Security by Design** | ✅ Pass | No direct prompt-level LLM changes; business logic encloses hybrid retrieval and error handling. |
| **VI. Observability** | ✅ Pass | TaskIQ processing states and error statuses are surfaced to the UI. |

> Note: The constitution explicitly mandates TaskIQ over Celery. The repository still contains legacy Celery references, so TECH_STACK.md should be updated separately to avoid confusion.

## Project Structure

### Documentation (this feature)

```text
specs/002-rag-adaptive-skill/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── hybrid-skill-api.md
└── spec.md
```

### Source Code (repository root)

```text
backend/
├── alembic/
├── src/
│   ├── api/
│   ├── models/
│   ├── services/
│   └── workers/
├── services/
│   ├── rag_service.py
│   ├── transcription_service.py
│   └── ...
├── tests/
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
```

**Structure Decision**: Option 2 — Monorepo Web App. Backend logic lives under `backend/`; frontend integration for real-time process visibility lives under `frontend/`.

## Complexity Tracking

No constitution violations were identified that require formal justification. The feature is aligned with the existing architectural constraints.
