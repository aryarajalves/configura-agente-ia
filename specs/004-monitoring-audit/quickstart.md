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
    Isto criará as tabelas `financial_records`, `system_settings`, `cleanup_jobs`, `container_health_metrics` e adicionará `target_entity_type`, `target_entity_id` e `deleted_user_display` à tabela `audit_logs`.

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

1. **Retenção de Dados (US1)**:
   - `GET /v1/system/settings` — Consultar configurações atuais de retenção e alerta.
   - `PATCH /v1/system/settings` — Atualizar o período de retenção e o limiar de alerta.
   - O TaskIQ cleanup job (`cleanup_audit_logs`) será executado diariamente e removerá logs mais antigos que o período configurado.
   - Em caso de 3 falhas consecutivas, um alerta crítico é emitido nos logs para o Dono.

2. **Monitoramento de Saúde (US1)**:
   - `GET /v1/system/metrics` — Consultar uso de disco e memória do contêiner.
   - O worker `poll_container_health` persiste snapshots históricos a cada 5 minutos.
   - Alertas são gerados automaticamente quando o uso de disco excede o limiar configurado.

3. **Dashboard Financeiro (US2)**:
   - `GET /v1/finance/summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — Resumo de custos.
   - `GET /v1/finance/agent/{agent_id}?start_date=...&end_date=...` — Detalhe por agente.
   - `GET /v1/finance/export?start_date=...&end_date=...` — Exportar registros em CSV.
   - Acesse o frontend em `/finance/costs` para visualizar o dashboard completo.

4. **Auditoria da Equipe (US3)**:
   - `GET /v1/audit?start_date=...&end_date=...&user_id=...&action=...&limit=20&offset=0` — Filtrar logs.
   - Usuários excluídos são exibidos com o campo `deleted_user_display` (ex: "João Silva (Removido)").
   - Acesse o frontend em `/audit-logs` para visualizar a tela completa com filtros.

## Frontend Routes

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/monitoring/health` | Saúde do sistema e configurações de retenção | Admin, SuperAdmin |
| `/finance/costs` | Dashboard financeiro granular | Admin, SuperAdmin |
| `/audit-logs` | Logs de auditoria filtráveis | SuperAdmin |

## Smoke Tests

### Checar métricas do sistema
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/v1/system/metrics
```

### Consultar configurações de retenção
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/v1/system/settings
```

### Atualizar período de retenção para 60 dias
```bash
curl -X PATCH -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"retention_period_days": 60}' \
  http://localhost:8000/v1/system/settings
```

### Consultar logs de auditoria
```bash
curl -H "Authorization: Bearer <token>" "http://localhost:8000/v1/audit?limit=20"
```

### Consultar resumo financeiro
```bash
curl -H "Authorization: Bearer <token>" "http://localhost:8000/v1/finance/summary?start_date=2026-04-01&end_date=2026-04-07"
```

### Exportar custos em CSV
```bash
curl -H "Authorization: Bearer <token>" "http://localhost:8000/v1/finance/export?start_date=2026-04-01&end_date=2026-04-07" -o costs.csv
```
