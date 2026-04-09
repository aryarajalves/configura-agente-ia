# Quickstart: Testing the Monitor Locally

1. **Fire up RabbitMQ & PostgreSQL**:
   Make sure you have `docker-compose up` running for external services.

2. **Start the TaskIQ Worker**:
   ```bash
   cd backend
   taskiq worker backend.worker.broker:broker
   ```

3. **Start the FastAPI Backend**:
   ```bash
   cd backend
   uvicorn backend.main:app --reload
   ```

4. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

5. **Trigger a test**:
   Hit the debug endpoint `POST /api/v1/processes/mock` to spawn a dummy process that ticks 5% progress every second. Watch the UI at `/processes` dynamically update via WebSockets.
