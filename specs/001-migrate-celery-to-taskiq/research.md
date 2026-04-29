# Research: Migrate Celery to TaskIQ and RabbitMQ

## Decision: TaskIQ + RabbitMQ Integration Pattern
- **Rationale**: Replaces legacy Celery with a modern async-native task queue.
- **Implementation**: Use `taskiq-aio-pika` as the broker and `taskiq-api-scheduler` for periodic tasks.
- **Alternatives considered**: `taskiq-redis` (Rejected per user request to use RabbitMQ).

## Decision: Database Connection Management in Workers
- **Rationale**: Ensuring clean async sessions and engine disposal between tasks.
- **Implementation**: Use TaskIQ lifecycle hooks (`startup`, `shutdown`) or TaskIQ dependencies (`TaskiqDepends`) to manage SQLAlchemy async sessions. Best practice is to use `TaskiqDepends` for session injection.
- **Alternatives considered**: Manual `asyncio.run` inside tasks (Rejected as inefficient).

## Decision: Consolidated Worker and Scheduler
- **Rationale**: User explicitly requested a single shared worker pool.
- **Implementation**: Run one `taskiq worker` command listening to all queues, and one `taskiq-api-scheduler` instance.
- **Alternatives considered**: Multiple worker containers (Rejected per user preference).

## Decision: Retry Middleware
- **Rationale**: Resiliency for external API calls (OpenAI, AssemblyAI).
- **Implementation**: Use `taskiq.middlewares.retry_middleware.SimpleRetryMiddleware`.
- **Alternatives considered**: Manual try/except retry logic (Rejected for cleaner declarative approach).

## Decision: RabbitMQ Config
- **Rationale**: Observability requested by the user.
- **Implementation**: Use official `rabbitmq:3-management` image. Enable RabbitMQ Management UI on port 15672. Use structured logging in the worker.
- **Alternatives considered**: `rabbitmq:latest` (Rejected as management plugin is needed).
