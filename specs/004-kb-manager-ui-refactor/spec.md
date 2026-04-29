# Feature Specification: KB Manager UI Refactor

**Feature Branch**: `004-kb-manager-ui-refactor`  
**Created**: 2026-04-27  
**Status**: Draft  
**Input**: User description: "no arquivo @[/mnt/D_DADOS/02_OPERACIONAL/TRABALHOS_ATIVOS/ALL_WORKS/Aryaraj/API - FluxAI/Projeto/o.c.a.ia-aryaraj-alternativ-branch/frontend/src/components/KnowledgeBaseManager.jsx] na div <div className=\"kb-quick-actions\"> que fica dentro de <div className=\"kb-content\" style={{ animation: 'fadeIn 0.4s ease-out' }}> vamos ter somente 4 botões: - Adicionar Novo - Adicionar Documentos - Transcrição de Vídeo - Upload Json. Vamos mover os botões \"Colar Texto\", Importar CSV / Excel e \"Upload PDF/DOCX'\" para um modal que abrirá quado clicar no botão \"Adicionar Documentos\". Vamos também mover a div <div className=\"kb-add-card\"> ... para um modal que ira abrir ao clicar em \"Adicionar Novo\""

## Clarifications

### Session 2026-04-27

- Q: Como deve ser a interação ao clicar em "Colar Texto" dentro do novo modal "Adicionar Documentos"? → A: O modal "Adicionar Documentos" fecha automaticamente e o modal "Colar Texto" abre em seguida (Opção A).
- Q: Se o usuário fechar o modal "Adicionar Novo" sem salvar, os dados são mantidos? → A: Sim, os dados permanecem nos campos até que sejam salvos ou a página seja recarregada (Opção A).
- Q: Qual o comportamento do botão "Upload PDF/DOCX" dentro do modal? → A: Abrir instantaneamente o seletor de arquivos do sistema (Opção A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Documents via Modal (Priority: P1)

The user wants to add multiple types of documents through a centralized interface. Instead of having many buttons visible at once, they click a single "Adicionar Documentos" button which opens a modal with options for "Colar Texto", "Importar CSV / Excel", and "Upload PDF/DOCX".

**Why this priority**: Simplifies the main UI and groups related actions together, which is the core of the request.

**Independent Test**: Click "Adicionar Documentos", see the modal, click "Colar Texto", and verify the text import flow works as before.

**Acceptance Scenarios**:

1. **Given** the Knowledge Base Manager is open, **When** clicking "Adicionar Documentos", **Then** a modal appears containing the 3 document import options: "Colar Texto", "Importar CSV / Excel", and "Upload PDF/DOCX".
2. **Given** the document import modal is open, **When** clicking "Colar Texto", **Then** the previous text paste modal is triggered.
3. **Given** the document import modal is open, **When** clicking "Importar CSV / Excel", **Then** the file picker for tabular data is triggered.

---

### User Story 2 - Add New Entry via Modal (Priority: P2)

The user wants to manually add a new Q&A pair without scrolling past a large form that is always present in the main view.

**Why this priority**: Improves focus and reduces visual clutter by hiding the secondary "Add" form until explicitly requested.

**Independent Test**: Click "Adicionar Novo", see the form in a modal, fill it, and click "Adicionar à Base" to see the item added to the list.

**Acceptance Scenarios**:

1. **Given** the Knowledge Base Manager is open, **When** clicking "Adicionar Novo", **Then** a modal appears with fields for Question, Metadata, Category, and Answer (previously in `kb-add-card`).
2. **Given** the "New Knowledge" modal is open, **When** clicking "Adicionar à Base", **Then** the item is saved to the base and the modal closes.

---

### User Story 3 - Clean Quick Actions Bar (Priority: P3)

The user wants a streamlined interface with only the most important entry points visible.

**Why this priority**: Aesthetic improvement and cognitive load reduction across the entire KB management experience.

**Independent Test**: Verify that exactly 4 buttons are visible in the `kb-quick-actions` div in the main component view.

**Acceptance Scenarios**:

1. **Given** the Knowledge Base Manager is open, **Then** the `kb-quick-actions` container contains exactly 4 buttons: "Adicionar Novo", "Adicionar Documentos", "Transcrição de Vídeo", and "Upload Json".

### Edge Cases

- **Mobile Responsiveness**: How do the new modals behave on small screens compared to the previous inline cards?
- **Discarding Changes**: If a user fills the "New Knowledge" modal and closes it without saving, the values MUST persist until a page reload or successful save.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show only 4 buttons in the quick actions bar: "Adicionar Novo", "Adicionar Documentos", "Transcrição de Vídeo", and "Upload Json".
- **FR-002**: System MUST move "Colar Texto", "Importar CSV / Excel", and "Upload PDF/DOCX" to a new modal triggered by the "Adicionar Documentos" button. Clicking "Upload PDF/DOCX" MUST immediately trigger the system file picker.
- **FR-003**: System MUST move the "Novo Conhecimento" (`kb-add-card`) section to a new modal triggered by the "Adicionar Novo" button.
- **FR-004**: Modals MUST preserve the existing styling (colors, gradients, spacing) and functionality of the elements they now contain.
- **FR-005**: All existing hooks and state variables (e.g., `newPair`, `handleAddItem`, `handleImportClick`) MUST continue to function correctly within the new modal contexts.
- **FR-006**: The "Add New" modal MUST include a "Cancel" or "Close" option that returns the user to the main list.

### Key Entities

- **Knowledge Base Item**: Represents a single Q/A or text entry in the repository. Unchanged by this UI refactor.
- **Global Modals**: New UI containers for grouping import and creation actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Main view vertical scrolling required to see the first 5 KB items is reduced (due to removal of the `kb-add-card` from the main flow).
- **SC-002**: Users can initiate any of the 6+ addition methods in no more than 2 clicks/interactions.
- **SC-003**: 0% regression in data import success rates from CSV, PDF, or Plain Text.

## Assumptions

- The project uses a standard modal pattern that can be reused for these new modals (potentially using `createPortal` as seen in existing code for `ConfirmModal` or `maximizedItem`).
- State variables like `newPair` can remain in the parent component and be passed down or accessed by the modal content.
- Moving the buttons to modals does not require any backend API changes.
