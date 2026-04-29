# Feature Specification: Fix Legacy Automated Tests

**Feature Branch**: `003-fix-legacy-tests`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "corrijir e atualizar os testes automatizados antigos que não funcionam mais"

## Clarifications

### Session 2026-04-15
- Q: Quais portas devem ser utilizadas nos testes? → A: Manter as portas atuais (Backend: 8002, Frontend: 5300, DB: 5433).
- Q: Onde os testes devem ser validados prioritariamente? → A: Dentro do Docker ( containers ).
- Q: Qual o escopo de compatibilidade dos testes? → A: Devem validar a infraestrutura atual e a compatibilidade com todos os sistemas novos (TaskIQ, novos modelos, etc) adicionados desde o início do projeto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend Test Stabilization (Priority: P1)

As a developer, I want to run backend tests to ensure the API and business logic are working correctly using the current infrastructure ports (Backend: 8002, DB: 5433).

**Why this priority**: High priority because failing tests block CI/CD pipelines and make it impossible to verify if new changes break existing functionality.

**Independent Test**: Can be fully tested by running `pytest backend/tests` in an environment with the database correctly configured and seeing all tests pass.

**Acceptance Scenarios**:

1. **Given** a backend environment, **When** running tests, **Then** the system must connect to the database on port 5433 (current infrastructure).
2. **Given** tests for both legacy features and new integrations (TaskIQ), **When** executed, **Then** all should correctly initialize and clean up in the current environment.
3. **Given** background task tests, **When** executed, **Then** they should correctly validate the modern logic using TaskIQ.

---

### User Story 2 - Frontend Test Stabilization (Priority: P1)

As a developer, I want to run frontend tests to ensure UI components and API interactions are correct with the current ports (5300 for frontend and 8002 for backend).

**Why this priority**: High priority to ensure UI reliability and correct communication between frontend and backend.

**Independent Test**: Can be fully tested by running `npm run test` in the `frontend` directory and seeing 100% success rate.

**Acceptance Scenarios**:

1. **Given** the frontend test setup (`setup.js`), **When** running tests, **Then** the mocked `window.location` must point to `localhost:5300`.
2. **Given** component tests (e.g., `Login.test.jsx`), **When** mocking API calls, **Then** the `API_URL` must point to `localhost:8002`.
3. **Given** Vitest/React Testing Library environment, **When** running tests, **Then** all dependencies must be correctly resolved without ESM/CJS errors.

---

### User Story 3 - Infrastructure Consistency in Tests (Priority: P2)

As a maintainer, I want all hardcoded references to old ports and legacy systems removed from the test files.

**Why this priority**: Prevents future confusion and makes the codebase cleaner and easier to maintain.

**Independent Test**: Can be verified by searching for strings like `8002`, `5300`, `5433`, and `celery` in the `tests` directories and finding zero occurrences in configuration or connection strings.

**Acceptance Scenarios**:

1. **Given** the codebase, **When** running automated tests, **Then** all connection strings must consistently use the current project ports (8002, 5300, 5433).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ensure `backend/tests/conftest.py` uses the standard `DATABASE_URL` (port 5433).
- **FR-002**: Validate `frontend/src/test/setup.js` and `frontend/package.json` to reflect current frontend port (5300) and correct Vitest configuration.
- **FR-003**: Update all frontend component tests to use the backend port (8002) for API mocks.
- **FR-004**: Convert/Refactor all legacy background task tests to use TaskIQ, ensuring logical compatibility with current state.
- **FR-005**: Ensure the test environment correctly loads variables from the root `.env` or has reasonable defaults for port 8002/5433.
- **FR-006**: Fix any broken imports in tests (particularly references to `services/` and `agent_service.py`) caused by migration.
- **FR-007**: Ensure `docker-compose-local.yml` or a dedicated `docker-compose-test.yml` supports running tests within containers.

### Key Entities *(include if feature involves data)*

- **Test Database**: A PostgreSQL database (or schema) used exclusively for automated tests.
- **TaskIQ Broker (Mocked)**: Mock implementation of the task broker to verify task submission without a running RabbitMQ instance during unit tests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `pytest backend/tests` returns 100% success (excluding known unimplemented features).
- **SC-002**: `npm run test` in `frontend` returns 100% success.
- **SC-003**: All test configurations correctly point to the active infrastructure ports (8002, 5300, 5433).
- **SC-004**: All background task tests use TaskIQ's `.kiq()` syntax or appropriate mocks.

## Assumptions

- The project uses `pytest` for backend and `Vitest` for frontend.
- Automated tests are executed within Docker containers to ensure consistency.
- A local database is available on port 5433 or can be started via Docker for integration tests.
- Existing tests were logically sound and only require infrastructure updates to pass.
- TaskIQ is the standard for background tasks across the entire project now.
