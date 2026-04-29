---
description: "Task list for implementing modal navigation, metadata toggle, and dynamic editing."
---

# Tasks: Modal Navigation and Content Editing

**Input**: Design documents from `specs/005-modal-navigation-edit/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize feature branch and verify environment context in `specs/005-modal-navigation-edit/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and analysis

- [ ] T002 Analyze `frontend/src/components/KnowledgeBaseManager.jsx` to identify optimal insertion points for navigation state and metadata rendering logic.

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Item Navigation (Priority: P1) 🎯 MVP

**Goal**: Navigate between database items using gallery-style side arrows and keyboard.

**Independent Test**: Open the visualization modal and use the side buttons or keyboard arrows to browse items. Verify buttons are hidden at boundaries.

### Implementation for User Story 1

- [ ] T003 [P] [US1] Implement large, semi-transparent navigation buttons (fixed at modal sides) using `ChevronLeft` and `ChevronRight` in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T004 [US1] Implement `useEffect` keyboard listener for Left/Right arrow keys in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T005 [US1] Add logic to hide/disable navigation controls at the start and end of the item list in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T006 [US1] Implement navigation locking logic to disable controls when `isEditing` is true in `frontend/src/components/KnowledgeBaseManager.jsx`.

**Checkpoint**: User Story 1 (Navigation) is functional and testable.

---

## Phase 4: User Story 2 - Content & Metadata Editing (Priority: P1)

**Goal**: Manage metadata with a toggleable JSON view and a dynamic key-value editor.

**Independent Test**: Toggle between List and JSON views in read mode. Enter Edit mode and successfully add, remove, and rename metadata keys.

### Implementation for User Story 2

- [ ] T007 [P] [US2] Implement `showJsonView` state and a toggle button to switch between simple list and formatted JSON (`<pre>`) in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T008 [US2] Implement dynamic metadata editor state (mapping object to an array of `{key, value}`) in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T009 [US2] Add "Add Field" and "Remove" (trash icon) functionality to the metadata editor rows in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T010 [US2] Ensure metadata keys (variable names) are rendered as editable inputs in the editor in `frontend/src/components/KnowledgeBaseManager.jsx`.

**Checkpoint**: User Story 2 (Metadata Management) is functional and testable.

---

## Phase 5: User Story 3 - Update Persistence (Priority: P1)

**Goal**: Persist all changes (content and metadata) to the backend.

**Independent Test**: Edit an item's content and metadata, click "Update", and verify the changes persist after a page refresh.

### Implementation for User Story 3

- [ ] T011 [US3] Implement data normalization logic to convert the metadata array back into a JSON object before submission in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T012 [US3] Update the `handleUpdate` (or equivalent) function to include the modified metadata in the `PUT` request payload in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T013 [US3] Implement loading state (e.g., button spinner) during the persistence operation to comply with Constitution Principle VIII in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T014 [US3] Implement "Cancel" button logic to revert all pending changes and return to view mode in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T015 [US3] Ensure success/error notifications are displayed after the persistence operation in `frontend/src/components/KnowledgeBaseManager.jsx`.

**Checkpoint**: All user stories are independently functional and integrated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: UI/UX refinement and final validation

- [ ] T016 [P] Refine CSS transitions for navigation buttons (using `scale-150` for high visibility) and metadata toggle in `frontend/src/components/KnowledgeBaseManager.jsx`.
- [ ] T017 [P] Validate SC-001: Verify navigation between 5 items completes in under 10 seconds.
- [ ] T018 [P] Validate SC-002: Verify text edit and save completes in under 15 seconds.
- [ ] T019 Run validation according to `specs/005-modal-navigation-edit/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Foundational**: Must complete first.
- **User Story 1 (Navigation)**: High priority MVP.
- **User Story 2 (Metadata Editor)**: Can proceed in parallel with US1 if UI space is managed.
- **User Story 3 (Persistence)**: Depends on US2 (Metadata Editor) being ready to provide data.

### Parallel Opportunities

- T003 and T007 can be worked on in parallel as they touch different UI sections.
- T014 (Polish) can be done partially during story implementation.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Navigation (US1) to enable browsing.
2. Validate navigation works as expected across list boundaries.

### Incremental Delivery

1. Foundation + Navigation (US1) -> Browse capability.
2. Metadata View Toggle (US2 part) -> Improved visualization.
3. Metadata Editor (US2 part) + Persistence (US3) -> Full management capability.
