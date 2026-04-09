import json
import redis.asyncio as redis
import os

redis_url = os.getenv("STR_REDIS_URL", "redis://localhost:6379/0")

class RedisBus:
    def __init__(self):
        self.redis = redis.from_url(redis_url)

    async def publish(self, channel: str, message: dict):
        await self.redis.publish(channel, json.dumps(message))

    async def subscribe(self, channel: str):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(channel)
        return pubsub

redis_bus = RedisBus()
