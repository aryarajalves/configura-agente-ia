# Implementation Plan: Migrate Celery to TaskIQ and RabbitMQ

**Branch**: `001-migrate-celery-to-taskiq` | **Date**: 2026-04-13 | **Spec**: [specs/001-migrate-celery-to-taskiq/spec.md](spec.md)
**Input**: Feature specification from `/specs/001-migrate-celery-to-taskiq/spec.md`

## Summary
The project will be migrated from a Celery/Redis/Flower task queue system to a modern, async-native architecture using TaskIQ and RabbitMQ. This transformation involves replacing the legacy Celery application and workers with a consolidated TaskIQ worker pool, implementing a TaskIQ scheduler for periodic tasks, and updating the container orchestration in `docker-compose-local.yml`. Visibility will be maintained through the RabbitMQ Management UI and structured logging.

## Technical Context
- **Language/Version**: Python 3.11
- **Primary Dependencies**: FastAPI, TaskIQ, taskiq-aio-pika, taskiq-api-scheduler, RabbitMQ
- **Storage**: PostgreSQL (pgvector) + SQLAlchemy (Async)
- **Testing**: pytest
- **Target Platform**: Linux (Docker)
- **Project Type**: Web service (FastAPI)
- **Performance Goals**: Seamless async background processing with automated retries.
- **Constraints**: Single consolidated worker pool; RabbitMQ Management UI on port 15672; 3 retries (exponential backoff).
- **Scale/Scope**: Replacement of all Celery-based infrastructure.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Tech Stack)**: Migration to TaskIQ + RabbitMQ is explicitly mandated.
- [x] **Principle IV (Performance)**: Offloading heavy work to TaskIQ queues.
- [x] **Principle VIII (UX/UI)**: Preserving real-time status updates via persistent logs.

## Project Structure

### Documentation (this feature)
```text
specs/001-migrate-celery-to-taskiq/
├── plan.md              # This file
├── research.md          # Research findings (TaskIQ lifecycle, retries, RabbitMQ config)
├── data-model.md        # Task status mapping and dependencies
├── quickstart.md        # Setup and monitoring instructions
├── contracts/           # Task payload schemas (internal)
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)
```text
backend/
├── broker.py            # TaskIQ broker and scheduler initialization
├── tasks.py             # Refactored task functions (decorated with @broker.task)
├── entrypoint.sh        # Updated to launch TaskIQ processes
└── requirements.txt     # Updated dependencies (added taskiq, removed celery/redis)

infra/
└── docker-compose-local.yml # Updated services (rabbitmq, backend, worker, scheduler)
```

**Structure Decision**: Option 2: Web application. The backend will be the focus of the task queue migration, ensuring the frontend's VITE_API_URL and monitoring remains functional.

## Complexity Tracking
- N/A

---

## Phase 0: Outline & Research
- [x] Research TaskIQ startup/shutdown hooks for SQLAlchemy async connection management.
- [x] Research TaskIQ Scheduler setup for a single shared worker.
- [x] Research RabbitMQ container configuration best practices (management plugin enabled).
- [x] Research TaskIQ Retry middleware (`SimpleRetryMiddleware`) configuration.

## Phase 1: Design & Contracts
- [x] Extract entities/states to `data-model.md`.
- [x] Define task interaction contracts.
- [x] Update agent context.
- [x] Finalize `quickstart.md`.
