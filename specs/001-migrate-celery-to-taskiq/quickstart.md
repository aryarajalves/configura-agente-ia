# Quickstart: Migrate to TaskIQ and RabbitMQ

## Local Development Setup

1. **Update .env**:
   Ensure the following environment variables are present:
   ```env
   RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672//
   # Remove old CELERY_BROKER_URL if desired, but TASKIQ will use RABBITMQ_URL
   ```

2. **Run Infrastructure**:
   ```bash
   docker compose -f infra/docker-compose-local.yml down
   docker compose -f infra/docker-compose-local.yml up --build
   ```

3. **Verify RabbitMQ**:
   Access the Management UI: `http://localhost:15672` (guest/guest).

4. **Monitoring Tasks**:
   Check the backend logs:
   ```bash
   docker logs -f backend-agente-local
   docker logs -f worker-agente-local
   ```

## Key Commands

- **Start Worker manually (for dev)**:
  `taskiq worker broker:broker tasks`
- **Start Scheduler manually (for dev)**:
  `taskiq scheduler broker:broker broker:scheduler`
