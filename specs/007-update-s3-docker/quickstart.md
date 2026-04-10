# Quickstart: S3 and Docker

1. Ensure your local `postgres` is running and attached to the `network_swarm_public` external Docker network.
2. Ensure you have removed `STR_REDIS_URL` from your `.env` file.
3. Update your `.env` file replacing all B2 variables with S3 equivalents and add `S3_REGION`.
4. Run:
```bash
docker-compose -f docker-compose-local.yml up
```
