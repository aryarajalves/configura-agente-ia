# Quickstart: Modal Navigation & Metadata Editor

## Prerequisites
- Frontend development environment (React/Vite).
- Backend API running with support for `PUT /knowledge-items/{id}`.

## Setup
1. Open `frontend/src/components/KnowledgeBaseManager.jsx`.
2. Locate the `ViewModal` component (or equivalent).

## Implementation Steps

### 1. Gallery Navigation
- Add `ChevronLeft` and `ChevronRight` from `lucide-react`.
- Position buttons at `top-1/2 -translate-y-1/2` on both sides of the modal content.
- Add `fixed` or `absolute` positioning with semi-transparent background (`bg-black/10`).

### 2. Metadata View Toggle
- Add a state `showJsonView` (boolean).
- In the metadata section, add a toggle button (e.g., using `Code` and `List` icons).
- Conditionally render either a simple list or a `<pre>` block with `JSON.stringify(metadata, null, 2)`.

### 3. Metadata Dynamic Editor
- Add state `editMetadata` as an array of `{key, value}`.
- Map through `editMetadata` to render pairs of inputs.
- Add "Add Field" and "Remove" buttons.
- On "Update", convert the array back to an object: `Object.fromEntries(editMetadata.map(m => [m.key, m.value]))`.

## Verification
1. Open a knowledge item.
2. Navigate between items using side buttons.
3. Toggle between List and JSON views.
4. Enter Edit mode, add a new metadata field, change a key name, and save.
5. Verify the backend receives the correct structure and the UI updates.
