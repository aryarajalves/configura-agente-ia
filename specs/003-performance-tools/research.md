# Research: Stress Test & Inbox Curation

## Decision

Implement the Performance & Aprimoramento feature using TaskIQ for all background processing, PostgreSQL + pgvector for similarity grouping, and LangGraph for AI persona orchestration.

## Rationale

- TaskIQ is mandatory by constitution for long-running jobs and retryable processing. This avoids blocked HTTP handling and aligns with existing backend patterns.
- PostgreSQL plus pgvector keeps the solution within the canonical stack and enables grouping Inbox failures by semantic similarity and impact.
- LangGraph is the natural orchestration layer for persona-driven simulated conversations and for generating initial AI suggested responses.
- Restricting Inbox access to Admins and authorized curators reduces operational risk and preserves the quality of curated RAG updates.

## Alternatives Considered

- Celery or synchronous processing: rejected because the constitution forbids Celery and because long-running stress tests must not tie up request threads.
- Pure frontend polling without TaskIQ: rejected because the feature requires durable, retryable background execution and technical logs.
- External vector database service: rejected in favor of pgvector to avoid introducing unsupported infra beyond the canonical stack.
- Letting all authenticated users access the Inbox: rejected in favor of a more controlled Admin/Curator role model.

## Outcomes

- The feature is designed to be implemented entirely within the existing FastAPI + TaskIQ + PostgreSQL architecture.
- The design supports real-time progress updates, grouped error curation, response editing, and safe RAG versioning.

## Inbox Grouping Logic

For semantic grouping of Inbox items:
- Use pgvector cosine similarity with a threshold of 0.85 for question embeddings.
- Group items if similarity > 0.85 and error type matches (e.g., both "response timeout").
- Frequency tracking: increment `frequencia_erro` for each new item in a group.
- Display groups sorted by total frequency descending.
