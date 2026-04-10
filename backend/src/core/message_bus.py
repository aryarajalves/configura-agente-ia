import json
import aio_pika
import os
import asyncio
import logging

logger = logging.getLogger(__name__)
rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

class MessageBus:
    """
    MessageBus using RabbitMQ (aio-pika) as a replacement for the legacy RedisBus pattern.
    Uses a TOPIC exchange named 'agente.events'.
    """
    def __init__(self):
        self._connection = None
        self._channel = None
        self._exchange = None
        self._url = rabbitmq_url

    async def _ensure_connected(self):
        if self._connection is None or self._connection.is_closed:
            try:
                self._connection = await aio_pika.connect_robust(self._url)
                self._channel = await self._connection.channel()
                self._exchange = await self._channel.declare_exchange(
                    "agente.events", 
                    aio_pika.ExchangeType.TOPIC
                )
                logger.info("MessageBus connected to RabbitMQ")
            except Exception as e:
                logger.error(f"Failed to connect MessageBus: {e}")
                raise

    async def publish(self, routing_key: str, message: dict):
        """
        Publishes a message to a specific routing key.
        """
        await self._ensure_connected()
        
        # Ensure routing_key is valid for AMQP (replaces : with . if needed)
        # Redis used task:uuid, AMQP usually uses task.uuid
        amqp_key = routing_key.replace(":", ".")
        
        await self._exchange.publish(
            aio_pika.Message(
                body=json.dumps(message).encode(),
                content_type="application/json"
            ),
            routing_key=amqp_key
        )

    async def subscribe(self, routing_key: str):
        """
        Subscribes to a routing key and returns the queue.
        """
        await self._ensure_connected()
        
        amqp_key = routing_key.replace(":", ".")
        queue = await self._channel.declare_queue(exclusive=True)
        await queue.bind(self._exchange, routing_key=amqp_key)
        return queue

    async def close(self):
        if self._connection:
            await self._connection.close()
            self._connection = None

message_bus = MessageBus()
