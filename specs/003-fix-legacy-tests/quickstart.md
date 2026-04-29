# Quickstart: Running Automated Tests in FluxAI

## Prerequisites
- Docker and Docker Compose installed.
- Local infrastructure running via `docker compose -f infra/docker-compose-local.yml up -d`.

## Backend Tests (Pytest)
To run backend tests inside the container:
```bash
docker exec -it backend-agente-local pytest backend/tests
```

## Frontend Tests (Vitest)
To run frontend tests inside the container:
```bash
docker exec -it frontend-agente-local npm run test
```

## Manual Database Access
To access the PostgreSQL console directly:
```bash
docker exec -it banco-agente-local psql -U admin_agente -d rag_db
```

## Troubleshooting
- **File Not Found**: If `docker compose` says the file was not found, ensure you are running the command from the repository root or use the full path to `infra/docker-compose-local.yml`.
- **Worker Connection**: If the worker is "Waiting for Database", run `docker compose -f infra/docker-compose-local.yml up -d --build` to re-create the containers with the fixed `DATABASE_URL`.
- **CORS Errors**: If the frontend cannot reach the backend, verify `CORS_ALLOWED_ORIGINS` in `.env` includes `http://localhost:5300`.
