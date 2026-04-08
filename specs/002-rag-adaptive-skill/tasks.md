# Tasks: RAG Adaptativo & Biblioteca de Habilidades

**Input**: Design documents from `/specs/002-rag-adaptive-skill/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/hybrid-skill-api.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the hybrid skill data model, vector support, and ingestion job infrastructure.

- [ ] T001 [P] Define hybrid skill entities in `backend/src/models/skill.py` for `Skill`, `SkillVersion`, `SkillSource`, and `VectorChunk`
- [ ] T002 [P] Add pgvector embedding support and `product_id` metadata mapping in `backend/src/models/skill.py`
- [ ] T003 [P] Add Pydantic schemas for hybrid skill creation, ingestion, query, status, and version management in `backend/src/models/schemas/skill_schemas.py`
- [ ] T004 Create an Alembic migration in `backend/alembic/versions/` to add `skills`, `skill_versions`, `skill_sources`, and `vector_chunks` tables with `product_id` metadata
- [ ] T005 [P] Implement TaskIQ ingestion job definitions and worker queue registration in `backend/src/workers/skill_ingestion.py`
- [ ] T006 [P] Add explicit transcription/audio-video ingestion support and schema fields in `backend/src/services/skill_ingestion_service.py` and `backend/src/workers/skill_ingestion.py`
- [ ] T007 [P] Add base hybrid skill service skeleton in `backend/src/services/skill_service.py`
- [ ] T008 [P] Add initial API route registration for hybrid skills in `backend/src/api/v1/skills.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement hybrid ingestion, versioning, permission gating, and real-time status infrastructure before user story work begins.

- [ ] T009 Implement `SkillService.create_hybrid_skill()` and `SkillService.start_ingestion()` in `backend/src/services/skill_service.py`
- [ ] T010 Implement `SkillVersionService` state transitions and active-version fallback semantics in `backend/src/services/skill_version_service.py`
- [ ] T011 Implement embedding generation and vector chunk persistence with `product_id` metadata in `backend/src/services/rag_service.py`
- [ ] T012 Implement the hybrid ingestion workflow in `backend/src/services/skill_ingestion_service.py` and wire it to TaskIQ task definitions from `backend/src/workers/skill_ingestion.py`
- [ ] T013 Implement Admin authorization and validation middleware for hybrid skill endpoints in `backend/src/api/v1/skills.py`
- [ ] T014 Implement skill status and version list endpoints in `backend/src/api/v1/skills.py`
- [ ] T015 [P] Add frontend status polling or SSE subscription support in `frontend/src/services/skillStatusService.ts`
- [ ] T016 [P] Add frontend components for hybrid skill creation and ingestion status in `frontend/src/components/HybridSkillCreation.tsx` and `frontend/src/components/HybridSkillStatus.tsx`
- [ ] T017 [US1] Implement validation for selected Postgres tables and `product_id` column mapping in `backend/src/services/skill_service.py`

---

## Phase 3: User Story 1 - Criação de Habilidade Híbrida (Priority: P1)

**Goal**: Enable Admins to create a new hybrid skill, upload documents, and select a Postgres table for product data linkage.

**Independent Test**: An Admin can create a hybrid skill and initiate ingestion, with status updates visible in the UI.

- [ ] T018 [US1] Implement the hybrid skill creation endpoint in `backend/src/api/v1/skills.py`
- [ ] T019 [US1] Implement source registration and ingestion initiation in `backend/src/api/v1/skills.py`
- [ ] T020 [US1] Implement front-end hybrid skill creation flow in `frontend/src/components/HybridSkillCreation.tsx`
- [ ] T021 [US1] Implement skill source upload and Postgres table selection UI in `frontend/src/components/HybridSkillCreation.tsx`
- [ ] T022 [US1] Implement ingestion status updates in `frontend/src/components/HybridSkillStatus.tsx`
- [ ] T023 [US1] Ensure ingestion job status is exposed by `backend/src/api/v1/skills.py`

---

## Phase 4: User Story 2 - Processamento com Versionamento (Priority: P2)

**Goal**: Allow a skill to be reprocessed while keeping the previous active version available until the new version is validated.

**Independent Test**: A skill linked to an active agent continues serving the old version while new ingestion runs, and the UI shows the pending status.

- [ ] T024 [US2] Implement pending skill version creation for each new ingestion run in `backend/src/services/skill_version_service.py`
- [ ] T025 [US2] Implement active-version fallback in `backend/src/services/skill_service.py`
- [ ] T026 [US2] Add version activation endpoint in `backend/src/api/v1/skills.py`
- [ ] T027 [US2] Add ingestion retry endpoint for failed skill versions in `backend/src/api/v1/skills.py`
- [ ] T028 [US2] Add frontend version status and retry controls in `frontend/src/components/HybridSkillStatus.tsx`
- [ ] T029 [US2] Ensure failed ingestion preserves prior active skill version in `backend/src/services/skill_version_service.py`

---

## Phase 5: User Story 3 - Vínculo Híbrido via ID (Priority: P3)

**Goal**: Retrieve RAG context and relational product data by `product_id` to answer price queries correctly.

**Independent Test**: A query with a valid `product_id` returns `source_context`, `price`, and `stock`.

- [ ] T030 [US3] Implement query endpoint in `backend/src/api/v1/skills.py`
- [ ] T031 [US3] Implement hybrid retrieval service in `backend/src/services/skill_query_service.py` that joins pgvector results with `ProductTable` by `product_id`
- [ ] T032 [US3] Add `product_id` propagation and duplicate conflict prevention in `backend/src/services/skill_ingestion_service.py`
- [ ] T033 [US3] Implement frontend query form and result display in `frontend/src/components/HybridSkillQuery.tsx`
- [ ] T034 [US3] Implement response enrichment with `price` and `stock` in `backend/src/services/skill_query_service.py`
- [ ] T035 [US3] Return a clear error message when `product_id` is missing from query context in `backend/src/api/v1/skills.py`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Add error handling, documentation, tests, and user-facing reliability features.

- [ ] T036 [P] [US3] Implement duplicate `product_id` conflict detection and user-friendly error handling in `backend/src/services/skill_ingestion_service.py`
- [ ] T037 [P] Add `attention` status handling for missing `product_id` metadata in `backend/src/services/skill_version_service.py`
- [ ] T038 [P] Add unit tests for hybrid skill creation, ingestion status, version activation, and hybrid product queries in `backend/tests/test_hybrid_skill.py`
- [ ] T039 [P] Add integration tests for hybrid query flows and version fallback in `backend/tests/test_hybrid_skill_integration.py`
- [ ] T040 [P] Add an end-to-end performance validation test that measures `SC-001` active version switch time under 2 seconds in `backend/tests/test_skill_version_performance.py`
- [ ] T041 [P] Add frontend test coverage for hybrid skill creation and status UI in `frontend/src/components/HybridSkillCreation.test.tsx`
- [ ] T042 [P] Update `specs/002-rag-adaptive-skill/quickstart.md` with exact hybrid skill usage and status verification steps`
- [ ] T043 [P] Review and update `specs/002-rag-adaptive-skill/contracts/hybrid-skill-api.md` to match implemented API routes
- [ ] T044 [P] Run end-to-end smoke test for hybrid skill creation, query by `product_id`, and version retry

---

## Dependencies & Execution Order

- Phase 1 tasks establish the hybrid skill model and ingestion infrastructure.
- Phase 2 tasks must complete before any story-specific endpoints and query logic can be implemented.
- Phase 3 can begin once core skill ingestion and status infrastructure exists.
- Phase 4 and Phase 5 depend on Phase 2 and may proceed after Phase 3 foundational flow is stable.
- Phase 6 can run in parallel after the main backend and frontend flows are implemented.

## Parallel Opportunities

- Tasks marked `[P]` can be implemented in parallel when they touch separate files or independent infrastructure.
- Backend model/schema work can proceed in parallel with frontend component scaffolding.
- TaskIQ worker implementation and API route scaffolding can proceed in parallel after the data model is defined.
- `skill_ingestion_service.py`, `skill_query_service.py`, and `skill_version_service.py` can be developed independently once the base models exist.
