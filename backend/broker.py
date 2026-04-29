"""
broker.py — TaskIQ broker, middleware, scheduler, and dependency injection.

This module replaces the legacy celery_app.py. It initialises:
  • AioPikaBroker  — connects to RabbitMQ
  • SimpleRetryMiddleware — 3 retries with exponential backoff
  • TaskiqScheduler — cron-based periodic tasks
  • get_db_session dependency — async SQLAlchemy session for task functions
"""

import os
import logging
from datetime import timedelta

from taskiq import TaskiqScheduler, TaskiqEvents
from taskiq.middlewares.retry_middleware import SimpleRetryMiddleware
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_aio_pika import AioPikaBroker

logger = logging.getLogger("taskiq")

# ---------------------------------------------------------------------------
# Broker
# ---------------------------------------------------------------------------
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672//")

broker = AioPikaBroker(url=RABBITMQ_URL).with_middlewares(
    SimpleRetryMiddleware(default_retry_count=3),
)

# ---------------------------------------------------------------------------
# Scheduler  (periodic / cron tasks)
# ---------------------------------------------------------------------------
scheduler = TaskiqScheduler(broker=broker, sources=[LabelScheduleSource(broker)])

# ---------------------------------------------------------------------------
# Lifecycle hooks — DB engine startup / shutdown
# ---------------------------------------------------------------------------

@broker.on_event(TaskiqEvents.WORKER_STARTUP)
async def _on_worker_startup(state):
    """Initialise the async DB engine once when the worker starts."""
    from database import engine  # noqa: delayed import to avoid circular deps
    state.engine = engine
    logger.info("TaskIQ worker started — DB engine ready.")


@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def _on_worker_shutdown(state):
    """Dispose the async DB engine cleanly when the worker shuts down."""
    from database import engine  # noqa
    await engine.dispose()
    logger.info("TaskIQ worker shutting down — DB engine disposed.")
