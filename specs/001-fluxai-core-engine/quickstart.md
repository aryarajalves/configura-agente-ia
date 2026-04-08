# Quickstart: Motor FluxAI

## Ambiente de Desenvolvimento

### Pré-requisitos
- Python 3.12+
- Docker & Docker Compose
- RabbitMQ rodando localmente (ou via Docker)

### Setup Inicial
1.  **Instalação de dependências**:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```
2.  **Variáveis de Ambiente**:
    Crie um arquivo `.env` baseado no `.env.example`:
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
uvicorn src.main:app --reload
```

### Worker (TaskIQ)
```bash
taskiq worker src.workers.broker:broker
```

## Verificação Técnica (Testes)

Para validar o fluxo de roteamento híbrido e segurança:
```bash
pytest testes/integration/test_orchestrator.py
```

### Smoke Test: Chat
```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "uuid-do-agente",
    "thread_id": "sessao-001",
    "message": "Qual é o preço do concorrente X?"
  }'
```
*Esperado: Resposta bloqueada por Guardline e log gerado.*
