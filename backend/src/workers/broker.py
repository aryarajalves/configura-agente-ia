import os
from taskiq import TaskiqEvents, InMemoryBroker
from taskiq_aio_pika import AioPikaBroker

# BROKER_URL from env or default
BROKER_URL = os.getenv("RABBIT_URL", "amqp://guest:guest@localhost:5672/")

# Use InMemoryBroker only if specifically requested or in testing mode
if os.getenv("TESTING") == "true" or BROKER_URL.startswith("memory://"):
    broker = InMemoryBroker()
else:
    broker = AioPikaBroker(BROKER_URL)

@broker.on_event(TaskiqEvents.WORKER_STARTUP)
async def startup() -> None:
    pass

@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def shutdown() -> None:
    pass
