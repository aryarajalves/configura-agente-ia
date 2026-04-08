# Research: Stress Test & Inbox Curation

## Decision

Implement the Performance & Aprimoramento feature using TaskIQ for all background processing, PostgreSQL for structured storage, and LangGraph for AI persona orchestration. Curation grouping will use string-based similarity (Levenshtein) instead of vector embeddings.

## Rationale

- TaskIQ is mandatory by constitution for long-running jobs and retryable processing. This avoids blocked HTTP handling and aligns with existing backend patterns.
- String similarity grouping (e.g., Levenshtein distance) provides sufficient clustering for common error types without the overhead of vector embedding generation for every doubt.
- LangGraph is the natural orchestration layer for persona-driven simulated conversations and for generating initial AI suggested responses.
- Restricting Inbox access to Admins and authorized curators reduces operational risk and preserves the quality of curated RAG updates.

## Alternatives Considered

- Celery or synchronous processing: rejected because the constitution forbids Celery and because long-running stress tests must not tie up request threads.
- Pure frontend polling without TaskIQ: rejected because the feature requires durable, retryable background execution and technical logs.
- pgvector / Vector embeddings: rejected based on user requirement to simplify the infrastructure for this specific grouping logic.
- External vector database service: rejected to maintain the canonical stack.
- Letting all authenticated users access the Inbox: rejected in favor of a more controlled Admin/Curator role model.

## Outcomes

- The feature is designed to be implemented entirely within the existing FastAPI + TaskIQ + PostgreSQL architecture.
- The design supports real-time progress updates, grouped error curation, response editing, and safe RAG versioning.

## Inbox Grouping Logic

For grouping of Inbox items:
- Use Levenshtein distance or Jaccard similarity threshold for question strings.
- Group items if similarity > 0.8 and error type/status matches.
- Frequency tracking: increment `frequencia_erro` for each new item in a group.
- Display groups sorted by total frequency descending.

## RAG Versioning Logic

To support FR-008 (updates without downtime), implementation will use a `version_id` snapshot on the `KnowledgeItem` table. The `InboxService` will create a new version of associated knowledge items during resolution, allowing the orchestrator to perform a swap once the update is verified.
