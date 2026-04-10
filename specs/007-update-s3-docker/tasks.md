# Tasks: Update S3 Keys and Docker Local

**Branch**: `007-update-s3-docker`
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

## Phase 1: Setup

> Essential project initialization and boilerplate. No story markers.

*(No tasks required for purely configuration-driven feature)*

## Phase 2: Foundational

> Core infrastructure and non-user-facing scaffolding. MUST be completed before story phases.

*(No foundational tasks required)*

## Phase 3: User Story 1 - Standardize Storage Environment Variables (P1)

> Standardize the storage environment variables from Backblaze B2-specific nomenclature to generic S3 concepts, and safely remove Redis configurations since they are no longer in use.

**Story Goal:** Variables natively read generic S3 terminology.
**Independent Test:** Application boots without crashing regarding missing B2 keys, and Redis errors don't trigger.

- [ ] T001 [P] [US1] Remove usage of `STR_REDIS_URL` in `backend/src/core/redis_bus.py`
- [ ] T002 [P] [US1] Remove usage of `STR_REDIS_URL` in `backend/src/tkq/tkq_config.py`
- [ ] T003 [P] [US1] Rename `B2_KEY_ID`, `B2_APPLICATION_KEY`, and `B2_BUCKET_NAME` references to `S3_` equivalents in `backend/src/services/cloud_service.py`
- [ ] T004 [P] [US1] Update `specs/005-cloud-ingestion-worker/quickstart.md` documentation references from `B2_` to `S3_` equivalents.

## Phase 4: User Story 2 - Local Docker Development without Postgres (P2)

> Update local compose files to remove Postgres instantiation and instead map to a running host DB over the swarm network.

**Story Goal:** Standalone DB is consumed over swarm network seamlessly.
**Independent Test:** `docker-compose -f infra/docker-compose-local.yml config` passes validation without complaining about the missing `db` service.

- [ ] T005 [P] [US2] Remove `depends_on: db` block from `backend` service in `infra/docker-compose-local.yml` to prevent validation failures.
- [ ] T006 [P] [US2] Assign the `backend` service to `network_swarm_public` in `infra/docker-compose-local.yml`.

## Phase 5: Polish & Cross-Cutting

- [ ] T007 Update `.env.example` (or instructions) replacing `B2_*` with `S3_*` and removing `STR_REDIS_URL`. We will manually add `S3_REGION` reference if an example file exists, else document it.

## Dependencies & Execution Order

- All tasks from T001 to T006 can be executed in parallel as they touch distinct scopes.
- T007 requires final variable validation check.
