import os
from taskiq_rabbit import RabbitmqBroker
from taskiq import TaskiqEvents

# BROKER_URL from env or default
BROKER_URL = os.getenv("RABBIT_URL", "amqp://guest:guest@localhost:5672/")

from taskiq import TaskiqEvents, TaskiqMiddleware
import time

class MetricsMiddleware(TaskiqMiddleware):
    async def pre_execute(self, task):
        task.custom_data["start_time"] = time.perf_counter()
        return task

    async def post_execute(self, task, result):
        duration = time.perf_counter() - task.custom_data["start_time"]
        print(f"Task {task.task_name} took {duration:.4f} seconds")

broker = RabbitmqBroker(BROKER_URL).with_middlewares(MetricsMiddleware())

@broker.on_event(TaskiqEvents.WORKER_STARTUP)
async def startup() -> None:
    # Any worker initialization logic
    pass

@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def shutdown() -> None:
    # Cleanup logic
    pass
