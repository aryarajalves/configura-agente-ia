# FluxAI API & Motor

FluxAI is the core intelligence orchestration engine. 
This service manages AI configuration, RAG ingestion, knowledge bases, financial metrics, and background processing via TaskIQ.

## Infrastructure

The application runs using Docker compose.
We use **RabbitMQ** for task queuing and a **PostgreSQL** database.

## Quickstart

Start the local stack (DB, API, Worker, RabbitMQ, Frontend):

```bash
cd infra
docker-compose -f docker-compose-local.yml up -d --build
```

Wait for the containers to fully initialize.

### Apply Migrations

To apply database updates (including the Knowledge Base structure), run the migrations inside the backend container:

```bash
docker exec -it backend-agente-local alembic upgrade head
```

### Accessing the System

- **Frontend**: `http://localhost:5173`
- **Backend API Docs (Swagger)**: `http://localhost:8000/docs`
- **RabbitMQ Management**: `http://localhost:15672` (guest/guest)
