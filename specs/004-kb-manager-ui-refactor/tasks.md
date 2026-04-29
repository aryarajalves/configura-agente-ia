---
description: "Task list for Knowledge Base Manager UI refactor"
---

# Tasks: KB Manager UI Refactor

**Input**: Design documents from `/specs/004-kb-manager-ui-refactor/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are NOT requested in the specification. Manual validation using quickstart.md is the primary verification method.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Component state preparation

- [X] T001 Initialize React states `isAddDocsModalOpen` and `isAddNewModalOpen` in `frontend/src/components/KnowledgeBaseManager.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core UI containers that block user story implementation

- [X] T002 Implement a reusable `BaseModal` helper or standard modal structure using `createPortal` in `frontend/src/components/KnowledgeBaseManager.jsx`

---

## Phase 3: User Story 1 - Add Documents via Modal (Priority: P1) 🎯 MVP

**Goal**: Centralize document import options into a single modal

**Independent Test**: Click "Adicionar Documentos", see selecting modal, click "Upload PDF", verify system picker.

### Implementation for User Story 1

- [X] T003 [US1] Create the `AddDocumentsModal` UI structure in `frontend/src/components/KnowledgeBaseManager.jsx`
- [X] T004 [US1] Move buttons "Colar Texto", "Importar CSV / Excel" and "Upload PDF/DOCX" from the main bar to the new modal in `frontend/src/components/KnowledgeBaseManager.jsx`
- [X] T005 [US1] Implement logic to close `AddDocumentsModal` and trigger existing `isTextModalOpen` for "Colar Texto" in `frontend/src/components/KnowledgeBaseManager.jsx`
- [X] T006 [US1] Map the "Upload PDF/DOCX" modal button to trigger `fileInputRef.current.click()` in `frontend/src/components/KnowledgeBaseManager.jsx`

**Checkpoint**: User Story 1 should be fully functional independently.

---

## Phase 4: User Story 2 - Add New Entry via Modal (Priority: P2)

**Goal**: Move the manual entry form to a modal for better list visibility

**Independent Test**: Click "Adicionar Novo", see form, fill data, close, reopen, verify data persistence.

### Implementation for User Story 2

- [X] T007 [US2] Create the `AddNewEntryModal` UI structure wrapping the existing `kb-add-card` logic in `frontend/src/components/KnowledgeBaseManager.jsx`
- [X] T008 [US2] Ensure `newPair` state binding is preserved within the modal to allow persistence on close in `frontend/src/components/KnowledgeBaseManager.jsx`
- [X] T009 [US2] Update `handleAddItem` to close the `AddNewEntryModal` upon successful addition in `frontend/src/components/KnowledgeBaseManager.jsx`

**Checkpoint**: User Story 2 should be functional independently.

---

## Phase 5: User Story 3 - Clean Quick Actions Bar (Priority: P3)

**Goal**: Streamline the main interface to the final desired state

**Independent Test**: Verify only 4 buttons remain: "Adicionar Novo", "Adicionar Documentos", "Transcrição de Vídeo", "Upload Json".

### Implementation for User Story 3

- [X] T010 [US3] Update main `kb-quick-actions` div to show only the 4 specified buttons in `frontend/src/components/KnowledgeBaseManager.jsx`
- [X] T011 [US3] Remove the previous inline `kb-add-card` section from the main component rendering in `frontend/src/components/KnowledgeBaseManager.jsx`

**Checkpoint**: Component UI refactor complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation

- [X] T012 Run validation against `specs/004-kb-manager-ui-refactor/quickstart.md`
- [X] T013 [P] Update local documentation or comments regarding the new modal structure in `frontend/src/components/KnowledgeBaseManager.jsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion.
- **User Stories (Phase 3-5)**: Depend on Phase 2. Can be worked on in order P1 -> P2 -> P3.

### Parallel Opportunities

- Since all implementation tasks are within `frontend/src/components/KnowledgeBaseManager.jsx`, parallel execution is limited to avoid merge conflicts within the same file.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational.
2. Complete User Story 1 (Add Documents).
3. **STOP and VALIDATE**: Verify that the new modal works and doesn't break existing import triggers.

### Incremental Delivery

1. Setup + Foundational → UI skeleton ready.
2. Add US 1 → Document selection hub ready.
3. Add US 2 → Manual entry modal ready.
4. Add US 3 → Final UI cleanup.
