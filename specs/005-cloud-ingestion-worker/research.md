# Research: Ingestão de Dados & Gestão de Nuvem (Backblaze)

## Unknowns & Research Tasks

### 1. Backblaze B2 Background Upload Pattern
**Goal**: Identify the best way to handle large file uploads (up to 2GB) in a TaskIQ worker.
**Decision**: Use the `b2sdk` (Backblaze SDK) with `UploadSource` and `ParallelDispatcher` for efficiency, but managed within the TaskIQ task lifecycle.
**Rationale**: The SDK handles chunking and retries internally. TaskIQ provides the background execution context.
**Alternatives Considered**: Direct S3-compatible API via `boto3`. Rejected because `b2sdk` is more native and handles B2-specific edge cases better.

### 2. TaskIQ Concurrency Control (IA Worker Limit)
**Goal**: Restrict the "vectorization" phase to 1 concurrent task as per Q4 clarification.
**Decision**: Use TaskIQ's `max_async_tasks` or a dedicated queue with a single consumer worker. Given the requirement to allow parallel uploads but serialized IA processing, a **two-stage pipeline** is optimal:
- `task_upload`: Parallel execution.
- `task_process_ia`: Dedicated queue `ia-priority` with `concurrency=1`.
**Rationale**: Segregating queues ensures that heavy IA tasks don't block light upload tasks, while honoring the 1-worker limit.

### 3. WebSocket Progress Pattern
**Goal**: How to notify the frontend of progress changes (Upload % and Stage transitions).
**Decision**: Use **Redis Pub/Sub** (integrated with FastAPI WebSockets).
- Worker publishes to `task_progress:{task_id}`.
- FastAPI WebSocket handler subscribes to the channel and forwards to the client.
**Rationale**: Decouples the worker (producer) from the API server (consumer/forwarder). Matches the existing stack (RabbitMQ for tasks, Redis usually available or RabbitMQ can also handle pub/sub, but Redis is standard for WS state).

### 4. SHA256 Hash Calculation
**Goal**: Validate if hashing should happen during upload stream to avoid double reading.
**Decision**: Use `hashlib.sha256()` with a buffer while reading the file from the temporary storage before/during upload to B2.
**Rationale**: Calculating while uploading saves an I/O pass on the disk.

## Summary of Decisions

| Item | Decision | Rationale |
|------|----------|-----------|
| **B2 Integration** | `b2sdk` (Python) | Native support, reliable chunking. |
| **Concurrency** | Dedicated `ia_queue` (limit=1) | Enforces 1-worker constraint for heavy tasks. |
| **Real-time** | Redis Pub/Sub + WebSockets | Standard decoupling for async updates. |
| **Hashing** | Server-side SHA256 during stream | Efficiency and consistency verification. |
