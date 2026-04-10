# Feature Specification: Update S3 Keys and Docker Local

**Feature Branch**: `007-update-s3-docker`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "1° Troque as chaves do Backblaze B2 para: B2_KEY_ID para S3_ACCESS_KEY_ID, B2_APPLICATION_KEY para S3_SECRET_ACCESS_KEY, B2_BUCKET_NAME para S3_BUCKET_NAME, STR_REDIS_URL para S3_REGION 2° Já tenho o postgres rodando, prepare o docker-compose-local.yml para rodar em localhost"

## Clarifications
### Session 2026-04-10
- Q: Why replace STR_REDIS_URL with S3_REGION? → A: Redis will not be used in this project, so the variable is removed/repurposed without breaking anything.
- Q: How should the Docker containers connect to the locally running Postgres database? → A: Through an external network named `network_swarm_public`.
- Q: What should replace the Redis broker for TaskIQ, and what happens to Celery/Flower? → A: TaskIQ will use RabbitMQ (taskiq-aio-pika), and Celery/Flower will be completely removed from the project.
- Q: What should replace the RedisBus (Pub/Sub) mechanism? → A: It will be replaced with a RabbitMQ implementation (via aio-pika).
- Q: How should we standardize the infrastructure and environment variables? → A: Use a single `RABBITMQ_URL` variable, remove legacy services (Redis, Celery, Flower) from all Docker Compose files, and update dependencies accordingly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standardize Storage Environment Variables (Priority: P1)

Developers need the storage environment variables standardized to use generic S3 names instead of Backblaze B2-specific nomenclature, ensuring compatibility across different S3-compatible providers.

**Why this priority**: Correct environment variables are foundational to connecting to storage services without breaking existing pipelines.

**Independent Test**: Can be tested independently by running the application locally or in Docker and verifying that it successfully connects to the S3-compatible service using the new environment variables (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_REGION`).

**Acceptance Scenarios**:

1. **Given** a `.env` file with the updated `S3_*` variables, **When** the application starts, **Then** it authenticates with the storage provider successfully.
2. **Given** a request to save or retrieve a file, **When** the application processes it, **Then** it uses the configured `S3_BUCKET_NAME` successfully.

---

### User Story 2 - Local Docker Development without Postgres (Priority: P2)

Developers running their own standalone Postgres database need a local docker-compose configuration that sets up other required services without conflicting with their running Postgres instance.

**Why this priority**: Improves local developer experience and resource usage flexibility.

**Independent Test**: Can be tested independently by running `docker-compose -f docker-compose-local.yml up` and confirming that it starts correctly, uses the host's Postgres connection, and does not try to spin up a duplicate Postgres container.

**Acceptance Scenarios**:

1. **Given** a running external Postgres DB accessible via `network_swarm_public`, **When** the developer starts `docker-compose-local.yml`, **Then** the application containers connect to the existing database via this external network without port collisions.
2. **Given** `docker-compose-local.yml`, **When** inspected, **Then** it does not include a `postgres` service block, or it disables it if previously defined.

### Edge Cases

- What happens if the old `B2_*` variables are still present in a developer's `.env`? (They should be ignored or mapped by the user).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST update all references of `B2_KEY_ID` to `S3_ACCESS_KEY_ID` across the codebase.
- **FR-002**: System MUST update all references of `B2_APPLICATION_KEY` to `S3_SECRET_ACCESS_KEY` across the codebase.
- **FR-003**: System MUST update all references of `B2_BUCKET_NAME` to `S3_BUCKET_NAME` across the codebase.
- **FR-004**: System MUST remove references of `STR_REDIS_URL` and establish `S3_REGION` in configuration, as Redis is not used in this project.
- **FR-005**: The `docker-compose-local.yml` configuration MUST NOT spin up its own PostgreSQL container instance.
- **FR-006**: The `docker-compose-local.yml` configuration MUST connect to a PostgreSQL instance already running via an external docker network named `network_swarm_public`.
- **FR-007**: System MUST replace TaskIQ Redis broker with RabbitMQ (taskiq-aio-pika).
- **FR-008**: System MUST completely remove Celery and Flower dependencies and related code.
- **FR-009**: System MUST replace the `RedisBus` Pub/Sub implementation with a RabbitMQ-based `MessageBus`.
- **FR-010**: System MUST standardize the broker connection string variable as `RABBITMQ_URL`.
- **FR-011**: System MUST remove `redis`, `celery`, and `flower` service definitions from all `docker-compose*.yml` files.

### Key Entities

- **Storage Client**: Modifies the credentials model and connection settings.
- **Environment Configuration**: Updates to `.env.example` or equivalent schema files for the new variables.
- **Docker Compose Local Config**: Changes to local service orchestration script.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the old B2 references are replaced with the new S3 terminology, and `STR_REDIS_URL` is completely removed.
- **SC-002**: Starting `docker-compose-local.yml` runs successfully without port 5432 conflicts on a system where postgres is already active.
- **SC-003**: Application containers successfully reach the host's local database and storage provider.

## Assumptions

- The external PostgreSQL instance is running on standard ports (5432) and is accessible via the `network_swarm_public` external network instead of localhost.
