from taskiq_aio_pika import AioPikaBroker
import os

rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

# Default broker using RabbitMQ
broker = AioPikaBroker(
    rabbitmq_url,
)
