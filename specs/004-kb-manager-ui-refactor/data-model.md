# Data Model & UI State: KB Manager UI Refactor

## UI State Entities

### KnowledgeBaseManagerState
Integrated into the main component.

- `isAddNewModalOpen` (boolean): Controls visibility of the "Novo Conhecimento" modal.
- `isAddDocsModalOpen` (boolean): Controls visibility of the document import selection modal.
- `newPair` (object): Shared state for manual entry, persisted across modal open/close.

## Interaction Flow

1. User clicks "Adicionar Novo" -> `setIsAddNewModalOpen(true)`.
2. User clicks "Adicionar Documentos" -> `setIsAddDocsModalOpen(true)`.
3. Modal interactions follow standard React state triggers.
