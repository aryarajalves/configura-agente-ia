# Implementation Plan: Fix Legacy Automated Tests

**Branch**: `003-fix-legacy-tests` | **Date**: 2026-04-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-fix-legacy-tests/spec.md`

## Summary

This feature aims to stabilize the automated test suite of FluxAI by resolving infrastructure-related failures and ensuring compatibility with recent system changes (TaskIQ transition). Currently, tests are failing due to hardcoded legacy ports and outdated background task patterns (Celery vs TaskIQ). The technical approach involves updating existing test configurations (`conftest.py`, `setup.js`) and refactoring test logic to align with the current project state (Backend: 8002, Frontend: 5300, DB: 5433, TaskIQ).

## Technical Context

**Language/Version**: Python 3.12+ (Backend), TypeScript/JavaScript (Frontend)  
**Primary Dependencies**: FastAPI, TaskIQ, Pydantic v2, React 19, Vitest, pytest-asyncio  
**Storage**: PostgreSQL (Port 5433)  
**Testing**: pytest (Backend), Vitest (Frontend)  
**Target Platform**: Docker-based Linux local environment  
**Project Type**: Web Application (Monorepo)  
**Performance Goals**: 100% test pass rate in local Docker CI simulation  
**Constraints**: MUST use current project ports: Backend 8002, Frontend 5300, DB 5433  
**Scale/Scope**: Refactoring all active test suites in `backend/tests` and `frontend/src/test`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **[x] Canonical Tech Stack**: All background task tests MUST use TaskIQ patterns. Presence of legacy Celery logic in active tests is a violation.
- **[x] Observability**: Test reports MUST provide clear process visibility (Hierarchical Logs) for debugging infrastructure failures.
- **[x] Service Layer Integrity**: Integration tests MUST validate that business logic remains in the service layer, even when triggered by background workers.

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-legacy-tests/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── tests/
│   ├── conftest.py           # MASTER FIX: Update DB port 5433
│   ├── test_background_tasks.py # UPDATE: TaskIQ logic
│   └── ... (others)
└── main.py

frontend/
├── src/
│   └── test/
│       ├── setup.js          # MASTER FIX: Update port 5300
│       ├── components/       # UPDATE: API Mocks to port 8002
│       └── ...
└── package.json

infra/
└── docker-compose-local.yml # REFERENCE: Verify ports 8002, 5300, 5433
```

**Structure Decision**: Monorepo structure with isolated backend/frontend test directories. No changes to base structure, only content updates to existing test files.

## Complexity Tracking

> *No constitution violations identified for this stabilization task.*
