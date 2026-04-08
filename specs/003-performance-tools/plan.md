# Implementation Plan: Performance & Aprimoramento (Módulo 3)

**Branch**: `003-performance-tools` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-performance-tools/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This feature extends FluxAI with an operational Stress Test and Inbox de curation pipeline.
It enables simulated AI persona conversations to run as TaskIQ background jobs, captures failures into a curated Inbox, and allows authorized Admin/Curator users to review, edit, approve, or block suggested fixes before they update the RAG knowledge base.

## Technical Context

**Language/Version**: Python 3.12+ (Async)  
**Primary Dependencies**: FastAPI, SQLAlchemy (Async), TaskIQ, RabbitMQ, Pydantic v2, LangGraph, pgvector  
**Storage**: PostgreSQL (relational) + pgvector for similarity grouping  
**Testing**: pytest + pytest-asyncio, frontend test runners as applicable  
**Target Platform**: Linux / Docker / On-premise deployment  
**Project Type**: Web service / AI orchestration feature  
**Performance Goals**: Stress Test progress updates within 3 seconds for UI visibility; enable an Admin to resolve 10 grouped errors with 2 clicks; preserve retry and timeout resilience for TaskIQ jobs  
**Constraints**: TaskIQ must handle all heavy background processing; no Celery or synchronous long-running ingestion; every schema change must ship with Alembic migration  
**Scale/Scope**: Moderate operational tooling for agent quality curation and simulated AI stress testing; not a full enterprise-scale knowledge graph release in this phase

## Constitution Check

*GATE: Passed on 2026-04-08. Feature aligns with the FluxAI constitution.*

| Principle | Status | Observation |
|---|---|---|
| **I. Canonical Stack** | ✅ Pass | Uses FastAPI, PostgreSQL, pgvector, TaskIQ, RabbitMQ in line with constitution. |
| **II. Service Layer** | ✅ Pass | Background processing and Inbox workflows are service-driven, with thin API routes. |
| **III. Data Integrity** | ✅ Pass | Entities support unique IDs, soft-delete assumptions, and versioned knowledge updates. |
| **IV. Performance & Resilience** | ✅ Pass | TaskIQ handles heavy operations; timeouts, retries, and error states are explicit. |
| **V. Security by Design** | ✅ Pass | Role-based Inbox access and JWT-backed auth remain consistent with constitution. |
| **VI. Observability** | ✅ Pass | Real-time process telemetry is required for every Stress Test and Inbox state update. |
| **VII. AI/LLM Integration** | ✅ Pass | Stress Test persona orchestration and Inbox suggestion filtering are managed as controlled AI workflows. |
| **VIII. UX/UI Integrity** | ✅ Pass | Requires explicit progress visibility and error log details for support workflows. |

> Note: This feature should avoid legacy Celery-based jobs despite any older repository references; TaskIQ + RabbitMQ is the approved background execution path.

## Project Structure

### Documentation (this feature)

```text
specs/003-performance-tools/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── stress-test-inbox-api.md
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
├── tests/
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
```

**Structure Decision**: Option 2 — Monorepo web application. Backend services implement TaskIQ stress-test orchestration and Inbox API surfaces, while the frontend integrates real-time progress and curation flows.

## Complexity Tracking

No constitution violations were identified that require formal justification. The feature is aligned with the existing architectural constraints and the current repo’s monorepo structure.
