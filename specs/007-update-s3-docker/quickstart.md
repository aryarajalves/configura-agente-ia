# Quickstart: S3 and RabbitMQ Infrastructure

This guide describes how to run the project after the infrastructure migration.

## Prerequisites
- Docker & Docker Compose
- RabbitMQ 3.x (with Management plugin)
- PostgreSQL (Active on `network_swarm_public`)

## Environment Setup
Update your `.env` file with the new variables:

```env
# Storage (Generic S3)
S3_ACCESS_KEY_ID=your_id
S3_SECRET_ACCESS_KEY=your_key
S3_BUCKET_NAME=your_bucket
S3_REGION=us-east-1

# Broker
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
```

## Running Locally
Start only the required services (excluding DB, which is external):

```bash
docker-compose -f infra/docker-compose-local.yml up -d
```

## Verifying Tasks
You can monitor RabbitMQ tasks via the management UI:
- **URL**: `http://localhost:15672`
- **User**: `guest`
- **Pass**: `guest`

The legacy `flower` and `redis` services are no longer used.
