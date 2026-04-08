# Research: RAG Adaptativo & Biblioteca de Habilidades

## Decision: Hybrid retrieval via pgvector + relational lookup

**Rationale**: The feature must combine semantic context from document embeddings with volatile product data in Postgres. Using pgvector for semantic search and a relational join on `product_id` gives the required hybrid retrieval while minimizing added infrastructure.
- **Decision**: Store embeddings and chunk metadata in a Postgres table with `pgvector`, and keep `product_id` as a first-class field in each vector chunk. Relational data such as `price` and `stock` are retrieved from a dedicated product table or volatile data store using the same `product_id`.
- **Alternatives considered**:
  - *Separate embedding store (e.g., vector DB outside Postgres)*: Rejected because the constitution already uses PostgreSQL + pgvector and the repo's architecture favors a single relational store for integrated data and auditability.
  - *Embedding-only retrieval with heuristic product inference*: Rejected because it would produce unreliable `product_id` matches and conflict with the explicit hybrid requirement.

## Decision: Versioned skill activation semantics

**Rationale**: The agent must remain stable while a skill is reprocessed and only switch when the new data is validated.
- **Decision**: Implement a versioned skill model where each ingestion run creates a pending `SkillVersion` and the active `SkillVersion` remains unchanged until processing finishes successfully. If ingestion fails, the prior version stays active and a retry path is offered.
- **Alternatives considered**:
  - *Incremental chunk updates directly into the active index*: Rejected due to risk of partial visibility and inconsistent agent behavior during long processing jobs.
  - *Automatic active swapping on first successful chunk*: Rejected because it violates the stability requirement for agents already using the skill.

## Decision: TaskIQ as mandatory background engine

**Rationale**: The constitution forbids Celery and synchronous heavy processing. TaskIQ is already present in the repo and is the correct backend for large PDF/video ingestion.
- **Decision**: All document ingestion, text extraction, embedding generation, and vector indexing must run as TaskIQ tasks. The API returns a task status token, and the frontend polls or subscribes to status updates.
- **Alternatives considered**:
  - *Synchronous ingestion in API handlers*: Rejected due to unacceptable latency and constitution rule against blocking I/O.
  - *Batch ingestion only with manual refresh*: Rejected because the feature requires real-time status updates and retry capabilities.

## Decision: Explicit `product_id` handling and error state

**Rationale**: Edge cases such as missing or duplicate IDs must be surfaced clearly for Admins.
- **Decision**: If a source chunk cannot be associated with a `product_id`, mark the skill version as `attention` and require manual mapping. If a duplicate `product_id` conflict is detected within the same skill, reject indexing and return a descriptive error.
- **Alternatives considered**:
  - *Auto-assign missing IDs via guesswork*: Rejected because it risks wrong product linkage and undermines data integrity.
  - *Allow duplicate product IDs with conflict resolution later*: Rejected because it would violate the explicit duplicate-ID guardrail in the feature spec.
