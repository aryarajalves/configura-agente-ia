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
curl http://localhost:8000/v1/skills/\<skill_id\>/status
```

### Smoke test de ingestão híbrida
```bash
curl -X POST http://localhost:8000/v1/skills/\<skill_id\>/ingest \
  -H "Content-Type: application/json" \
  -d '{"source_type":"pdf","source_uri":"/tmp/product-guide.pdf"}'
```

### Smoke test de consulta híbrida
```bash
curl -X POST http://localhost:8000/v1/skills/\<skill_id\>/query \
  -H "Content-Type: application/json" \
  -d '{"question":"Qual é o preço deste produto?","product_id":"ABC123"}'
```

> Ajuste os caminhos de endpoint quando a API final estiver implementada. Estes exemplos refletem o contrato de interface proposto em `contracts/hybrid-skill-api.md`.
