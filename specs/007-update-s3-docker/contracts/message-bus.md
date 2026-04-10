# Contract: Message Bus (RabbitMQ)

The `MessageBus` replaces the `RedisBus` for real-time state updates (Pub/Sub).

## Interface

### `publish(channel: str, message: dict)`
Sends a JSON-serialized message to the specified channel.
- **Implementation**: Uses a `fanout` exchange named after the channel (or a central exchange with routing keys).
- **Default Exchange**: `agente.events` (topic).

### `subscribe(channel: str)`
Subscribes to messages on a specified channel.
- **Implementation**: Creates an exclusive temporary queue bound to the given routing key on the `agente.events` exchange.

## Message Format (Standard)

```json
{
  "task_id": "uuid-string",
  "status": "initiated | uploading | processing | completed | failed",
  "step": "Human readable description",
  "progress": 0-100,
  "error": "Optional error string"
}
```

## Channel Naming Convention
- `task:{task_id}` - For specific task progress updates.
- `global:events` - For broadcast notifications.
