# API Contracts: Monitorização e Auditoria (Módulo 4)

## Authorization
- Audit endpoints and system settings endpoints are restricted to `Owner` / `SUPERADMIN`.
- Financial dashboard endpoints may be accessible to `Owner` and `Admin` roles depending on governance policy.

## Endpoints

### GET /v1/audit

- **Description**: Lista logs de auditoria com filtros básicos.
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD), opcional
  - `end_date`: string (YYYY-MM-DD), opcional
  - `user_id`: UUID, opcional
  - `action`: string, opcional
  - `limit`: integer, opcional
  - `offset`: integer, opcional
- **Response**:
  - `data`: lista de objetos AuditLog
  - `pagination`: `limit`, `offset`, `total`

#### AuditLog object
- `id`: UUID
- `agent_id`: UUID
- `superadmin_id`: UUID
- `action`: string
- `target_entity_type`: string
- `target_entity_id`: UUID or null
- `previous_state`: JSON
- `new_state`: JSON
- `timestamp`: string
- `deleted_user_display`: string or null

---

### GET /v1/finance/summary

- **Description**: Retorna o resumo de custos para o período selecionado.
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD)
  - `end_date`: string (YYYY-MM-DD)
- **Response**:
  - `total_cost`: numeric
  - `total_tokens`: integer
  - `by_service`: lista de `{ service: string, cost: numeric, token_count: integer }`
  - `daily_trend`: lista de `{ date: string, cost: numeric }`

---

### GET /v1/finance/agent/{agent_id}

- **Description**: Retorna detalhes financeiros por agente.
- **Path Parameters**:
  - `agent_id`: UUID
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD)
  - `end_date`: string (YYYY-MM-DD)
- **Response**:
  - `agent_id`: UUID
  - `agent_name`: string
  - `cost_by_skill`: lista de `{ skill_id: UUID, skill_name: string, type: string, token_count: integer, estimated_cost: numeric }`
  - `total_cost`: numeric

---

### GET /v1/finance/export

- **Description**: Exporta registros financeiros em CSV.
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD)
  - `end_date`: string (YYYY-MM-DD)
  - `agent_id`: UUID, opcional
  - `type`: string, opcional
- **Response**:
  - `content-type`: `text/csv`
  - CSV rows with `agent_id`, `skill_id`, `token_count`, `estimated_cost`, `type`, `period_start`, `period_end`

---

### GET /v1/system/settings

- **Description**: Obtém as configurações atuais de retenção e alerta.
- **Response**:
  - `retention_period_days`: integer
  - `storage_threshold_alert`: integer
  - `last_cleanup_timestamp`: string
  - `updated_by`: UUID
  - `updated_at`: string

---

### PATCH /v1/system/settings

- **Description**: Atualiza a política de retenção e alertas.
- **Request Body**:
  - `retention_period_days`: integer
  - `storage_threshold_alert`: integer
- **Response**:
  - `success`: boolean
  - `data`: updated SystemSettings object

---

### GET /v1/system/metrics

- **Description**: Retorna métricas do contêiner Docker relevantes para monitoramento.
- **Response**:
  - `disk_usage_percent`: numeric
  - `memory_usage_percent`: numeric
  - `disk_available_bytes`: integer
  - `memory_available_bytes`: integer
  - `timestamp`: string
