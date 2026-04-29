# Data Model: Metadata & Navigation State

## Entities

### Metadata Row (Frontend State Only)
Represents a single editable row in the metadata editor.
- `key`: string (The name of the variable)
- `value`: string (The value of the variable)

### Knowledge Item (API Payload)
The data structure sent to the backend.
- `id`: UUID
- `question`: string
- `answer`: string
- `metadata`: Object (Map of keys to values)

## State Transitions

| Current State | Action | Next State |
|---|---|---|
| Viewing (List) | Click "JSON Toggle" | Viewing (JSON) |
| Viewing (JSON) | Click "JSON Toggle" | Viewing (List) |
| Viewing | Click "Edit" | Editing |
| Editing | Click "Add Field" | Editing (with new empty row) |
| Editing | Click "Remove" | Editing (with row removed) |
| Editing | Click "Update" | Viewing (Updated Data) |
| Editing | Click "Cancel" | Viewing (Original Data) |

## Validations
1. **Unique Keys**: Before saving, duplicate keys in the metadata array must be merged or flagged.
2. **JSON Syntax**: If editing in a raw JSON field (if implemented), must validate before saving.
