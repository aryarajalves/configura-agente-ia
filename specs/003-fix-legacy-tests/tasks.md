# Tasks: Fix Legacy Automated Tests

**Input**: Design documents from `/specs/003-fix-legacy-tests/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

- [x] Phase 1: Setup (Shared Infrastructure)
    - [x] T001 Verify Docker local environment and connectivity
    - [x] T002 Check if root `.env` has the correct `DATABASE_URL` and `API_PORT` (8002, 5300, 5433)
    - [x] T003 Verify if `backend/tests/pytest.ini` exists and supports async-mode auto

- [x] Phase 2: Foundational (Blocking Prerequisites)
    - [x] T004 Standardize ports in `infra/docker-compose-local.yml` (8002, 5300, 5433)

- [x] Phase 3: User Story 1 - Backend Test Stabilization
    - [x] T005 Update `DATABASE_URL` in `backend/tests/conftest.py` to point to port 5433
    - [x] T006 Remove legacy Celery `.delay()` mocks in `backend/tests/test_background_tasks.py`
    - [x] T007 Implement TaskIQ `.kiq()` mocks in `backend/tests/test_background_tasks.py`
    - [x] T008 Fix broken imports in `backend/tests/`
    - [x] T009 Fix `BackgroundProcessLog` status assertions to match current `models.py` state

- [x] Phase 4: User Story 2 - Frontend Test Stabilization
    - [x] T010 Update `window.location` and `origin` to `localhost:5300` in `frontend/src/test/setup.js`
    - [x] T011 Update mocked `API_URL` to `http://localhost:8002` in `frontend/src/test/components/Login.test.jsx`
    - [x] T012 Update mocked `API_URL` to `http://localhost:8002` in `frontend/src/test/components/Dashboard.test.jsx`
    - [x] T013 Update mocked `API_URL` to `http://localhost:8002` in `frontend/src/test/components/KnowledgeBaseManager.test.jsx`
    - [x] T014 Ensure `vitest` configuration points to the correct `setup.js`

- [x] Phase 5: User Story 3 - Infrastructure Consistency & Compatibility
    - [x] T015 Perform global search and replace for legacy ports (`8000`, `5173`, `5432`)
    - [x] T016 Validate that `process_video_task` tests in `backend/tests/test_background_tasks.py` use current payload structure
    - [x] T017 Update `frontend/src/test/mocks/apiMock.js` to use port 8002

- [x] Phase 6: Polish & Cross-Cutting Concerns
    - [x] T018 Documentation updates in `quickstart.md` regarding test execution
    - [x] T019 Code cleanup in test files
    - [x] T020 Run full regression test suite across both stacks (Confirm 100% pass rate)
    - [x] T021 Verify CORS stability between Frontend (5300) and Backend (8002) in browser
