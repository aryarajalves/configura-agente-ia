# Data Model: Background Process Monitor

## Entities

### 1. `Process`
Represents the overarching workflow execution (e.g. Document Upload + RAG Ingestion).
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key) -> ensures access control
- `name` (String) -> Human-readable title
- `type` (Enum) -> e.g. UPLOAD, AI_PROCESSING, DB_MAINTENANCE
- `status` (Enum) -> PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `total_progress` (Float) -> 0.0 to 100.0 global aggregate
- `current_step_name` (String) -> Display shortcut
- `created_at`, `updated_at`, `deleted_at` (Timestamps with Soft Delete)

### 2. `Step`
Represents a sub-part of a process with its own weight.
- `id` (UUID, Primary Key)
- `process_id` (UUID, Foreign Key) -> cascades on hard delete
- `name` (String)
- `weight_percentage` (Float) -> e.g. 30.0 for 30%. Sum of all steps should be 100
- `order` (Integer) -> Determines step sequence
- `status` (Enum) -> PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `created_at`, `updated_at`, `deleted_at` (Timestamps)

### 3. `LogEntry`
Detailed log entries mapped to specific steps.
- `id` (UUID, Primary Key)
- `step_id` (UUID, Foreign Key)
- `level` (Enum) -> INFO, WARN, ERROR
- `message` (String)
- `metadata_json` (JSONB) -> Complete technical stacktraces/LangGraph logs
- `timestamp` (Timestamp with Timezone)
