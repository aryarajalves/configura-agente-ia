# Quickstart: RAG Adaptativo & Biblioteca de Habilidades

## Ambiente de Desenvolvimento

### Pré-requisitos
- Python 3.12+
- Docker & Docker Compose
- RabbitMQ rodando localmente (ou via Docker)
- Postgres com extensão `pgvector`

### Setup Inicial
1.  **Instalação de dependências**:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```
2.  **Variáveis de ambiente**:
    Crie um arquivo `.env` baseado no `.env.example` e configure as credenciais.
    ```env
    DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/fluxai
    RABBITMQ_URL=amqp://guest:guest@localhost:5672/
    OPENAI_API_KEY=sk-...
    ```
3.  **Migrations**:
    ```bash
    alembic upgrade head
    ```

## Execução

### API Server
```bash
uvicorn backend.src.main:app --reload
```

### Worker (TaskIQ)
```bash
taskiq worker backend.src.workers.broker:broker
```

## Verificação de Funcionalidade

### Checar status de skill
```bash
curl http://localhost:8000/api/v1/skills/\<skill_id\>/versions/latest
```

### Smoke test de ingestão híbrida
```bash
# 1. Register Source
curl -X POST http://localhost:8000/api/v1/skills/\<skill_id\>/sources \
  -H "Content-Type: application/json" \
  -d '{"source_type":"pdf","uri":"/tmp/product-guide.pdf","metadata_":{"product_id": "ABC123"}}'

# 2. Trigger Ingestion Version
curl -X POST http://localhost:8000/api/v1/skills/\<skill_id\>/versions
```

### Smoke test de consulta híbrida
```bash
curl -X POST http://localhost:8000/api/v1/skills/\<skill_id\>/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Qual é o preço deste produto?","context":{"product_id":"ABC123"}}'
```
