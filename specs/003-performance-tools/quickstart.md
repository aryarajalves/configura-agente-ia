# Quickstart: Performance & Aprimoramento (Módulo 3)

## Prerequisites

- Python 3.12+
- Docker and Docker Compose (or equivalent RabbitMQ/Postgres environment)
- RabbitMQ accessible via `RABBITMQ_URL`
- PostgreSQL accessible via `DATABASE_URL`
- Node.js if frontend integration is required

## Setup

1. Start infrastructure services:

```bash
# From repository root
docker compose -f infra/docker-compose-local.yml up -d postgres rabbitmq
```

2. Configure environment variables:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/fluxai"
export RABBITMQ_URL="amqp://guest:guest@localhost:5672/"
export TASKIQ_BROKER_URL="$RABBITMQ_URL"
```

3. Install backend dependencies:

```bash
cd backend
pip install -r requirements.txt
```

4. Run database migrations:

```bash
cd backend
alembic upgrade head
```

## Run the feature

1. Start the backend API:

```bash
cd backend
uvicorn main:app --reload
```

2. Start the TaskIQ worker:

```bash
cd backend
taskiq worker src.workers.broker:broker
```

3. Open the admin UI and access the Performance / Stress Test dashboard.
4. Create a new Stress Test session by selecting a persona and importing conversation logs.
5. Monitor progress through the dashboard and verify that the session status updates in real time.
6. Open the Inbox de Dúvidas, review grouped failures, edit or accept AI suggestions, and save corrections.

## Validation

- Confirm Stress Test sessions create a `relatorio_md_link` and show accurate progress.
- Confirm Inbox items group by similarity and only authorized Admin/Curator roles can access the Inbox.
- Confirm discarded or blocked failures do not update the RAG knowledge base.

## Notes

- This feature relies on TaskIQ for background work and real-time progress visibility in the frontend.
- Use the API contract in `specs/003-performance-tools/contracts/stress-test-inbox-api.md` for UI integration details.
