# Research & Decisions: Background Process Monitor

### Decision 1: Real-time UI State (WebSockets vs Server-Sent Events)
- **Decision**: WebSockets
- **Rationale**: While SSE handles server-to-client streaming well and is HTTP native, WebSockets allow bidirectional commands (e.g. Pause, Resume, Cancel process) cleanly matching our real-time interactive requirements for this dashboard.
- **Alternatives considered**: Server-Sent Events (Rejected due to unidirectional limits when managing retries). Long Polling (Rejected due to latency > 1s violation possibility and heavy server load).

### Decision 2: Log Storage (PostgreSQL vs Redis/ElasticSearch)
- **Decision**: PostgreSQL with partitioning or short retention limits
- **Rationale**: Standardizing around PostgreSQL keeps infrastructure surface small per the Constitution. Since this is on-premise, minimizing the number of distinct databases is critical. By implementing heavily enforced routine auto-cleanup (worker diário), we prevent DB bloat without adding new tech.
- **Alternatives considered**: ElasticSearch (Rejected: against Canonical Tech Stack), Redis Streams (Rejected: harder to join with relational `Process` states for UI filtering).

### Decision 3: Task Checkpointing & Retries
- **Decision**: TaskIQ State Management integrated with Database Steps
- **Rationale**: TaskIQ directly allows retry triggers. We will structure pipelines logically in Postgres via `Steps`. When a pipeline fails (e.g., Step 3/LangGraph), the UI "Retry" endpoint reads the Postgres last incomplete step and enqueues a new TaskIQ message initializing from that specific Step index.
- **Alternatives considered**: Entire pipeline re-run (Rejected: costs tokens/compute unnecessarily).
