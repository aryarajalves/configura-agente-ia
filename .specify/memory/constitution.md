<!--
=============================================================================
SYNC IMPACT REPORT
=============================================================================
Version change: 1.0.0 → 2.0.0
Modified principles: 
  - I. Canonical Tech Stack (Updated to include TaskIQ, RabbitMQ, LangGraph, proper Frontend stack, pgvector, and Backblaze B2)
  - III. Data Integrity & Persistence (Added shared unique ID constraint for RAG vs Relational sync)
  - IV. Performance & Resilience (Changed Celery to TaskIQ + RabbitMQ, added memory auto-cleanup/cache refresh rules, defined graceful degradation constraints)
  - VII. AI/LLM Integration Discipline (Added Hybrid model constraint [Primary + Fallback] and Hybrid Complexity Mode routing)
Added sections:
  - VIII. UX/UI Integrity & Background Monitoring (Added constraint for process visibility and hierarchical logs)
Removed sections:
  - None
Templates requiring updates:
  ✅ .specify/templates/plan-template.md
  ✅ .specify/templates/spec-template.md 
  ✅ .specify/templates/tasks-template.md 
Deferred TODOs:
  - TECH_STACK.md needs to be synced with the new architectural constraints (specifically Celery -> TaskIQ and adding frontend).
=============================================================================
-->

# FluxAI — Aryaraj Constitution

## Core Principles

### I. Canonical Tech Stack (NON-NEGOTIABLE)

The technical architecture decisions encoded in `TECH_STACK.md` (repository root)
are the **sole authoritative reference** for all implementation choices. Every
feature, PR, and AI suggestion MUST comply with the stack defined there. No
alternative technology MAY be introduced without a formal constitution amendment.

Concrete mandates derived from the FluxAI Refactoring Briefing:

- **Backend**: Python with FastAPI. No other server-side language permitted. Focus on async performance.
- **Frontend**: TypeScript with React + Tailwind CSS + shadcn/ui. Focus on clean UX.
- **Database**: PostgreSQL with pgvector (for vector search) + SQLAlchemy ORM and Alembic migrations.
- **Background tasks**: TaskIQ + RabbitMQ. Celery or synchronous handling of long-running work is forbidden.
- **AI Orchestration**: LangGraph for complex flows and multi-agent conversations.
- **Object Storage**: Backblaze B2 for external static file storage.
- **Data validation**: Pydantic (v2+). All API input/output schemas MUST use Pydantic models.
- **Repository layout**: Monorepo (`frontend/` + `backend/` at root).
- **Naming**: English identifiers throughout. snake_case for Python, camelCase for TypeScript.

> **Rationale**: The refactored stack aims to completely eliminate the bottlenecks found in the previous version, enabling heavy background processing without stalling the main UI.

### II. Service Layer Architecture (NON-NEGOTIABLE)

Business rules MUST live in `*_service.py` files under `backend/services/`.
Routes and controllers are thin: they validate input (Pydantic), delegate to a
service, and return the result. No business logic in route handlers.

Permitted service layer patterns:

- `rag_service.py`, `transcription_service.py`, `agent_service.py` — one file per bounded domain.
- Bases of knowledge MUST be decoupled and connected as autonomous skills.
- Services MUST NOT import from each other circularly. Shared utilities go in `backend/utils/` or `backend/core/`.

> **Rationale**: Separation of concerns allows skills (like Agenda, Support) to have independent data structures, connecting to different agents seamlessly.

### III. Data Integrity & Persistence (NON-NEGOTIABLE)

All persistence decisions MUST support the hybrid RAG architecture:

- **Unified Identity**: All knowledge items MUST share a unique ID across the Postgres relational database and the pgvector vector database for absolute synchronization.
- **Soft delete**: All entities MUST implement soft delete (`deleted_at`).
- **Alembic migrations**: Every schema change MUST ship with an Alembic migration file.
- **Audit Logging**: Any mutation of agent configuration, user permissions, or sensitive data MUST write an audit record (who, what, when, before/after) to support the Owner auditing dashboard.
- **Independent Skill Tables**: Each skill MUST have its own independent data structure allowing modular "plugging".

> **Rationale**: Hybrid RAG requires seamless ID sync to fetch both volatile tabular data (e.g., pricing) and fixed semantic vectors concurrently.

### IV. Performance & Resilience (NON-NEGOTIABLE)

- **No blocking I/O**: LLM calls, video/PDF ingestion, and heavy indexing MUST be offloaded to TaskIQ queues.
- **Heavy Processing Retry**: TaskIQ tasks for file ingestions MUST preserve partial states on error and expose a "Retry" mechanism without re-processing from zero.
- **Degradation Path**: If Postgres goes offline or external APIs time out, the system MUST fallback gracefully (use cached data or return polite maintenance messages, no JSON traceback leaks to users).
- **Cache Volatile Data**: Responses from LLM APIs and frequently-read agent configurations MUST be cached.
- **Memory Auto-cleanup**: The system MUST implement routine auto-cleanup of temporary logs and processing files to protect client on-premise server disks.

> **Rationale**: The system must sustain heavy background ingestion (e.g., 2GB videos, 10+ concurrent files) without degrading the live chat speed.

### V. Security by Design (NON-NEGOTIABLE)

- **LLM Context Privacy**: Personally identifiable data (PII) MUST NOT be included verbatim in prompts sent to external LLM providers. Tokenization or redaction is required.
- **Authentication**: JWT tokens only. Passwords MUST use bcrypt hashes.
- **Role-Based Access**: Rigid isolation between Owner (Auditing, Financials), Admin (Agent Config), and User (Chat Monitor, Doubt Inbox).
- **Secret management**: All keys MUST be in `.env`.

> **Rationale**: As an on-premise platform dealing with private data, guardlines, topic filters, and PII protection are critical selling points.

### VI. Observability & Quality Gates (NON-NEGOTIABLE)

- **Definition of Done**: Merged to main, automated tests pass, deployed, and manual smoke test green. 
- **Error tracking**: All unhandled exceptions MUST be captured. 
- **Auditability**: Complete tracking of every system modification for Owner review.
- **Financial Tracking**: Every agent interaction and fine-tuning job MUST be tagged and tracked against cost metrics for the Dashboard Financeiro.

> **Rationale**: Without strict observability, tracking token/cost usage per agent per skill is impossible.

### VII. AI/LLM Integration Discipline (NON-NEGOTIABLE)

- **Dual-Model Agility**: Every agent MUST be configured with a Primary LLM and a Fallback LLM pair.
- **Automatic Fallback Switching**: If the Primary LLM times out or fails, the router MUST seamlessly switch to the Fallback without breaking the user chat experience.
- **Hybrid Complexity Mode**: The orchestration layer MUST evaluate if a prompt is "Simple" or "Complex" and route it to the respective size model to optimize token cost.
- **Fine-Tuning / Stress Test loop**: Agents MUST undergo periodic simulated AI vs AI stress tests, reporting errors directly to the Doubt Inbox (Inbox de Dúvidas).

> **Rationale**: Controlling LLM unreliability through seamless fallbacks and minimizing costs via smart routing is a fundamental core feature of FluxAI.

### VIII. UX/UI Integrity & Background Monitoring (NON-NEGOTIABLE)

- **System Visibility**: Background processes MUST always expose real-time progress indicators on the frontend. The user must never guess if a file is processing.
- **Hierarchical Logs**: Errors and background processes MUST expose a Clean View (Running, Success, Error) and a Technical Modal (TaskIQ trace) for quick support debugging.

> **Rationale**: Since heavy lifting is moved to TaskIQ, the UI must compensate by aggressively communicating state, so the client feels entirely in control.

---

## Technical Standards

### Database & ORM
| Decision | Choice | 
|---|---|
| RDBMS | PostgreSQL + pgvector | 
| ORM | SQLAlchemy | 
| Migrations | Alembic |
| Multi-tenancy | Row-level (tenant_id) | 

### API & Communication
| Decision | Choice |
|---|---|
| API style | REST (FastAPI) | 
| Real-time updates | WebSockets / SSE |
| Background Jobs | TaskIQ + RabbitMQ |

### Infrastructure & Deployment
| Decision | Choice |
|---|---|
| Deployment | On-premise via Docker |
| Orchestration | LangGraph |
| Storage | Backblaze B2 |

---

## Development Workflow

1. **Feature branch** from `main` → open PR → peer review → squash merge.
2. **Commit format**: `type(scope): description`.
3. **Definition of Done**: tests pass in CI + deployed to staging + smoke test green + review approved.
4. **Constitution amendments**: Require a PR touching this file, with a version bump and Sync Impact Report.

---

## Governance

This constitution supersedes all other team conventions, README instructions, and historical practices. In case of conflict, this document wins.

### Amendment Procedure
1. Open a PR that modifies `.specify/memory/constitution.md`.
2. Increment `CONSTITUTION_VERSION`.
3. Update the Sync Impact Report.

---

**Version**: 2.0.0 | **Ratified**: 2026-04-06 | **Last Amended**: 2026-04-07
