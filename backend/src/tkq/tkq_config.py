from taskiq_redis import ListQueueBroker
from taskiq import TaskiqEvents
import os

redis_url = os.getenv("STR_REDIS_URL", "redis://localhost:6379/0")

# Default broker
broker = ListQueueBroker(
    redis_url,
).with_result_backend(redis_url)
