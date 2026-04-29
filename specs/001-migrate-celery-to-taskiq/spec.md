# Feature Specification: Migrate Celery to TaskIQ and RabbitMQ

**Feature Branch**: `001-migrate-celery-to-taskiq`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "Retirando qualquer indicio dos serviços celery, flower e redis e trocando para FastAPI + TaskIQ + Rabbit e se sertificando que o deploy do projeto em docker local usando infra/docker-compose-local.yml esteja funcional"

## Clarifications

### Session 2026-04-13

- Q: How would you like to monitor the status and execution of TaskIQ background tasks in the local environment? → A: Use RabbitMQ Management UI + Structured Backend Logs
- Q: How should TaskIQ handle temporary failures when calling external APIs? → A: Enable automatic retries with exponential backoff (3 attempts)
- Q: Do you want to preserve the scheduled log cleanup task using the TaskIQ scheduler? → A: Yes, implement using TaskIQ Scheduler
- Q: Should we maintain separate task queues for different processing types? → A: No, consolidate into a single shared worker pool
- Q: Keep current ports (8002 for backend, 5300 for frontend)? → A: Yes, do not change to 8000/5173.
- Q: Should backend and worker depend on the external postgres service? → A: Yes, add dependency on postgres service from docker-compose-db.yml.
- Q: Address frontend connectivity errors (ERR_EMPTY_RESPONSE/CONNECTION_RESET)? → A: Yes, fix the backend startup and port conflicts causing these errors.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Process Background Tasks (Priority: P1)

As a system administrator, I want background tasks (like video transcription and knowledge base creation) to be processed reliably using a modern task queue system (TaskIQ), so that the application remains responsive and scalable.

**Why this priority**: Core functionality of the application depends on these background tasks. Without them, the processing of media and knowledge extraction fails.

**Independent Test**: Can be tested by uploading a video or JSON file for processing and verifying that the background task is triggered, executed, and its status updated in the database.

**Acceptance Scenarios**:

1. **Given** a video file ready for transcription, **When** the user triggers the processing, **Then** a background task should be enqueued in RabbitMQ via TaskIQ and eventually processed successfully.
2. **Given** a background task is running, **When** the processing progress increases, **Then** the `background_process_logs` table should be updated accordingly.

---

### User Story 2 - System Infrastructure Modernization (Priority: P2)

As a developer, I want to remove legacy dependencies (Celery, Flower, Redis) and standardize on TaskIQ and RabbitMQ, so that the project architecture is cleaner and easier to maintain.

**Why this priority**: Reduces technical debt and simplifies the container orchestration.

**Independent Test**: Can be tested by running `docker compose up` and verifying that only the required services (db, backend, rabbitmq, worker, frontend) are running and communicating correctly.

**Acceptance Scenarios**:

1. **Given** the updated `docker-compose-local.yml`, **When** the services are started, **Then** Redis and Flower should no longer be present, and RabbitMQ should be used as the broker.
2. **Given** the backend code, **When** searched for "celery", "redis", or "flower", **Then** no active code references should remain.

---

### Edge Cases

- **Task Failure Handling**: How does the system handle tasks that fail due to external API errors (e.g., OpenAI or AssemblyAI timeouts)? TaskIQ should report the failure and update the log status to "ERRO".
- **Database Connection Persistence**: Ensure that TaskIQ workers maintain or correctly re-establish database connections between task executions.
- **Broker Unavailability**: If RabbitMQ is down, the system should handle enqueue errors gracefully and provide feedback to the user or retry later.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST use TaskIQ with RabbitMQ as the broker for all background tasks.
- **FR-002**: System MUST remove all Celery-related files (e.g., `celery_app.py`, `backend/tasks.py` legacy code) and decorators (`@app.task`).
- **FR-003**: System MUST update the backend application to initialize TaskIQ and register all task functions.
- **FR-004**: System MUST update `infra/docker-compose-local.yml` to replace multiple Celery workers (default and json) and beat with a single TaskIQ worker pool and a single scheduler service.
- **FR-005**: System MUST ensure that the existing task logic (transcription, RAG processing, JSON import) is preserved and works correctly within the TaskIQ environment.
- **FR-006**: System MUST remove Flower and Redis services from the infrastructure.
- **FR-007**: System MUST fix the RabbitMQ container configuration to use a proper official image (e.g., `rabbitmq:3-management`) instead of the custom/incorrect path.
- **FR-008**: System MUST implement structured logging in backend workers and ensure RabbitMQ Management plugin is enabled for task visibility.
- **FR-009**: System MUST configure TaskIQ with a global or per-task retry policy (e.g., SimpleRetryMiddleware) for 3 attempts with exponential backoff.
- **FR-010**: System MUST implement the TaskIQ Scheduler component to handle the periodic log cleanup task (daily at midnight).
- **FR-011**: System MUST ensure backend and worker services depend on the `postgres` service (from `docker-compose-db.yml`).
- **FR-012**: System MUST resolve the port conflict on 8002 and ensure the frontend can successfully reach the backend API.

### Key Entities *(include if feature involves data)*

- **BackgroundProcessLog**: Represents a record of a background task execution, including its status, progress, and result details.
- **TaskIQ Broker**: The RabbitMQ-based broker responsible for message distribution.
- **TaskIQ Worker**: The process that executes the background tasks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of background tasks previously handled by Celery are successfully executed by TaskIQ.
- **SC-002**: Zero references to Celery, Flower, or Redis in the final codebase and configuration files.
- **SC-003**: The project starts and runs successfully in a local Docker environment with a single command (`docker compose up`).
- **SC-004**: Task status updates in the database are accurately reflected in the UI (via the `background_process_logs` table).

## Assumptions

- **Assumption 1**: RabbitMQ will be the sole message broker for background tasks.
- **Assumption 2**: TaskIQ will handle both ad-hoc tasks and any necessary scheduled tasks.
- **Assumption 3**: The existing `background_process_logs` table structure is sufficient for tracking TaskIQ task statuses without schema changes.
- **Assumption 4**: Use of `taskiq-aio-pika` for RabbitMQ integration.
