# Quickstart: Monitorização e Auditoria (Módulo 4)

## Ambiente de Desenvolvimento

### Pré-requisitos
- Python 3.12+
- Docker & Docker Compose
- RabbitMQ rodando localmente (ou via Docker)
- Banco de dados PostgreSQL disponível

### Setup Inicial

1.  **Instalar dependências**:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```
2.  **Configurar variáveis**:
    Crie um `.env` a partir do `.env.example` e inclua as configurações do PostgreSQL e RabbitMQ.
3.  **Executar migrations**:
    ```bash
    alembic upgrade head
    ```

## Execução

### Iniciar API
```bash
cd backend
uvicorn src.main:app --reload
```

### Iniciar worker TaskIQ
```bash
taskiq worker backend.src.workers.broker:broker
```

### Verificação do fluxo de governança

1. Atualizar as configurações de retenção via API / front-end.
2. Confirmar que a tarefa `cleanup` é registrada no banco de dados.
3. Acessar o dashboard financeiro e verificar o total estimado por agente.
4. Acessar a tela de auditoria e filtrar por data ou usuário.
5. Consultar as métricas do contêiner no endpoint de monitoramento.

## Smoke Tests

### Checar métricas do sistema
```bash
curl http://localhost:8000/v1/system/metrics
```

### Consultar logs de auditoria
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/v1/audit?limit=20
```

### Exportar custos em CSV
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/v1/finance/export?start_date=2026-04-01&end_date=2026-04-07
```
