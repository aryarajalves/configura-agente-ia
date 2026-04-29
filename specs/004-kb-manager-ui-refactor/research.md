# Research: KB Manager UI Refactor

## Decision: Reuse Project's Modal Pattern with createPortal

- **Rationale**: The project already uses `createPortal` for `maximizedItem` and `ConfirmModal`. Reusing this pattern ensures consistency in Z-index management and accessibility across the application.
- **Alternatives considered**: 
    - **In-component state-driven rendering**: Rejected because it can cause overflow issues if parent containers have `overflow: hidden` (like `kb-item-modern`).
    - **shadcn/ui Dialog**: Considered, but since the project is currently a mix of Javascript and custom styles, introducing a headless UI component might require more setup than a portable CSS-based modal for this specific refactor.

## Decision: Modal Content Structure

- **Add New Modal**: Will wrap the existing `kb-add-card` logic. State `newPair` will remain in `KnowledgeBaseManager` to ensure persistence as per clarification Q2.
- **Add Documents Modal**: Will be a "Selection Hub" with 3 buttons.
    - "Colar Texto" → Triggers `setIsTextModalOpen(true)` and closes parent.
    - "Importar CSV / Excel" → Triggers existing importer logic.
    - "Upload PDF/DOCX" → Triggers `fileInputRef.current.click()`.

## Best Practices for "Premium Design" in this Project

- Use `backdrop-filter: blur(8px)` and semi-transparent dark backgrounds.
- Maintain the `var(--accent-gradient)` for primary buttons and accents.
- Add `fadeIn` and `slideUp` animations for modal entry.
