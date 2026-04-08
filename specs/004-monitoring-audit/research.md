# Research: Monitorização e Auditoria (Módulo 4)

## Decision: Internal token-based cost validation

- **Decision**: The dashboard will validate cost accuracy using an internal estimate derived from token consumption and the provider pricing rules already present in `backend/router_import.py`.
- **Rationale**: In an on-premise Docker deployment, external provider invoices may not be available or reliable as a primary validation source. Internal token-based estimation gives predictable, auditable values and aligns with the existing codebase.
- **Alternatives considered**:
  - External invoice reconciliation: rejected because the feature must work without direct invoice ingestion and because on-premise installations may not have centralized provider billing.
  - Only token volume without pricing: rejected because the business requires cost visibility, not just usage visibility.

## Decision: TaskIQ for retention cleanup and monitoring jobs

- **Decision**: Use TaskIQ background tasks for daily data retention cleanup, retry tracking, and health-monitoring polling.
- **Rationale**: The project constitution explicitly mandates TaskIQ + RabbitMQ for long-running jobs and forbids Celery. The repository already contains `backend/src/workers/cleanup.py`, making TaskIQ the proper execution pattern.
- **Alternatives considered**:
  - Synchronous cleanup in request handlers: rejected because it would block the API and violate the constitution's no blocking I/O constraint.
  - External cron or OS scheduler: rejected because the feature should be self-contained inside the Docker deployment.

## Decision: Extend existing audit log model

- **Decision**: Reuse and extend the existing `backend/src/models/audit.py` `AuditLog` entity for generic audit actions across agents, skills, and user configuration changes.
- **Rationale**: The repository already implements audit logging and exposure via `backend/src/api/v1/audit.py`. Extending this model reduces schema duplication and ensures consistent audit semantics.
- **Alternatives considered**:
  - Create a separate `audit_action_logs` table: rejected because it would duplicate audit semantics and require additional integration work.

## Decision: Docker container health via cgroup metrics

- **Decision**: Collect disk and memory health metrics from container-friendly Linux interfaces, such as cgroup files or container runtime boundaries, rather than relying on Docker socket APIs.
- **Rationale**: On-premise Docker deployments may not expose the Docker socket to application containers. cgroup-based metrics work within the container and support Linux host environments.
- **Alternatives considered**:
  - Docker Engine API / `docker stats`: rejected because it may require privileged access and is less portable inside a sealed deployment.

## Assumptions validated

- TaskIQ is already the canonical worker framework in this repository.
- Audit logging is already implemented for agent changes and can be generalized.
- Internal pricing rules can be derived from existing `MODEL_INFO` or similar configuration.
- System settings can be persisted in PostgreSQL and exposed through FastAPI.
