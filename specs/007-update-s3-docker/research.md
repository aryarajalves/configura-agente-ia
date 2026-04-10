# Research: S3 Variables and Docker Compose Let

## 1. Replacing B2 variables with S3 equivalents
- **Decision:** Replace `B2_KEY_ID`, `B2_APPLICATION_KEY`, and `B2_BUCKET_NAME` with `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET_NAME` respectively in `.env` templates, `settings` configuration models, and `cloud_service.py` where they are consumed.
- **Rationale:** Aligns with standard S3-compatible service properties (like AWS S3, MinIO, etc.) instead of being vendor-locked to Backblaze terms structurally. Even though the stack states Backblaze B2, generic S3 names are more standard for S3-compatible APIs like `boto3`.
- **Alternatives considered:** None, explicitly requested.

## 2. Removing Redis and Adding S3_REGION
- **Decision:** Delete `STR_REDIS_URL` usage (`redis_bus.py`, `tkq_config.py`, configuration settings). Add support for `S3_REGION`.
- **Rationale:** User clarified Redis won't be used. We need to introduce the missing S3 variable. Since `redis_bus.py` etc are currently trying to use this, we may need to gut Redis completely if the project drops it, or just drop the variable if we are only changing configuration now. Wait, Constitution says `TaskIQ + RabbitMQ`. So Redis can indeed be safely gutted as it's not the canonical broker. Let's just remove the env var calls.
- **Alternatives considered:** Keeping Redis for cache; rejected per user clarification.

## 3. External Postgres Network
- **Decision:** Remove the `postgres` service from `docker-compose-local.yml`. Add external network `network_swarm_public` logic. Application services will connect through this.
- **Rationale:** Developer has a local running postgres out of this compose stack on that specific network.
- **Alternatives considered:** `host.docker.internal` or `network_mode: "host"`, rejected by user.
