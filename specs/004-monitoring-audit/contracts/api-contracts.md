# API Contracts: Monitorização e Auditoria (Módulo 4)

## Authorization
- Audit endpoints (`/v1/audit`) and system settings endpoints (`/v1/system/settings`) are restricted to `SUPERADMIN`.
- Financial dashboard endpoints (`/v1/finance/*`) are accessible to `Owner` (SUPERADMIN) and `ADMIN` roles.
- System metrics endpoint (`/v1/system/metrics`) is accessible to `Owner` (SUPERADMIN) and `ADMIN` roles.

## Endpoints

### GET /v1/audit

- **Description**: Lista logs de auditoria com filtros, paginação e ordenação cronológica.
- **Auth**: `SUPERADMIN` required
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD), opcional
  - `end_date`: string (YYYY-MM-DD), opcional
  - `user_id`: UUID, opcional — filtra por `superadmin_id`
  - `action`: string, opcional — ex: `UPDATE_CONFIG`, `LOCK_AGENT`, `DELETE_USER`
  - `limit`: integer, opcional (default: 100, max: 500)
  - `offset`: integer, opcional (default: 0)
- **Response** (`SuccessResponse`):
  - `success`: boolean
  - `data.data`: lista de objetos AuditLog
  - `data.pagination`: `{ limit, offset, total }`

#### AuditLog object
- `id`: UUID
- `agent_id`: UUID or null
- `superadmin_id`: UUID
- `action`: string
- `target_entity_type`: string or null — `"agent"`, `"skill"`, `"user"`, `"system_settings"`
- `target_entity_id`: UUID or null
- `previous_state`: JSON or null
- `new_state`: JSON or null
- `timestamp`: ISO 8601 string
- `deleted_user_display`: string or null — ex: `"João Silva (Removido)"`

---

### GET /v1/finance/summary

- **Description**: Retorna o resumo de custos para o período selecionado.
- **Auth**: `SUPERADMIN` or `ADMIN`
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD), **required**
  - `end_date`: string (YYYY-MM-DD), **required**
- **Validation**: `start_date` must be ≤ `end_date`
- **Response** (`SuccessResponse`):
  - `data.total_cost`: numeric (USD)
  - `data.total_tokens`: integer
  - `data.by_service`: list of `{ service: string, cost: numeric, token_count: integer }`
  - `data.daily_trend`: list of `{ date: string, cost: numeric }`

---

### GET /v1/finance/agent/{agent_id}

- **Description**: Retorna detalhes financeiros por agente.
- **Auth**: `SUPERADMIN` or `ADMIN`
- **Path Parameters**:
  - `agent_id`: UUID
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD), **required**
  - `end_date`: string (YYYY-MM-DD), **required**
- **Response** (`SuccessResponse`):
  - `data.agent_id`: UUID
  - `data.agent_name`: string
  - `data.cost_by_skill`: list of `{ skill_id: UUID|null, skill_name: string, type: string, token_count: integer, estimated_cost: numeric }`
  - `data.total_cost`: numeric

---

### GET /v1/finance/export

- **Description**: Exporta registros financeiros em CSV.
- **Auth**: `SUPERADMIN` or `ADMIN`
- **Query Parameters**:
  - `start_date`: string (YYYY-MM-DD), **required**
  - `end_date`: string (YYYY-MM-DD), **required**
  - `agent_id`: UUID, opcional
  - `type`: string, opcional — `"chat"`, `"fine_tuning"`, `"ingestion"`
- **Response**:
  - `content-type`: `text/csv`
  - `Content-Disposition`: `attachment; filename=finance_export_{start}_{end}.csv`
  - CSV columns: `agent_id`, `skill_id`, `token_count`, `estimated_cost`, `type`, `period_start`, `period_end`

---

### GET /v1/system/settings

- **Description**: Obtém as configurações atuais de retenção e alerta.
- **Auth**: `SUPERADMIN` required
- **Response** (`SuccessResponse`):
  - `data.retention_period_days`: integer
  - `data.storage_threshold_alert`: integer
  - `data.last_cleanup_timestamp`: ISO 8601 string or null
  - `data.updated_by`: UUID or null
  - `data.updated_at`: ISO 8601 string or null

---

### PATCH /v1/system/settings

- **Description**: Atualiza a política de retenção e alertas.
- **Auth**: `SUPERADMIN` required
- **Request Body** (JSON):
  - `retention_period_days`: integer, optional (min: 1)
  - `storage_threshold_alert`: integer, optional (min: 1, max: 100)
- **Validation**: Values outside allowed ranges return HTTP 422
- **Side Effect**: Creates an AuditLog entry with `action=UPDATE_SETTINGS`
- **Response** (`SuccessResponse`):
  - `data`: updated SystemSettings object (same shape as GET response)
  - `message`: `"Configurações atualizadas com sucesso"`

---

### GET /v1/system/metrics

- **Description**: Retorna métricas do contêiner Docker relevantes para monitoramento.
- **Auth**: `SUPERADMIN` or `ADMIN`
- **Response** (direct JSON, not wrapped in SuccessResponse):
  - `disk_usage_percent`: numeric
  - `memory_usage_percent`: numeric
  - `disk_available_bytes`: integer
  - `memory_available_bytes`: integer
  - `timestamp`: ISO 8601 string

---

## Error Responses

All endpoints return standard `ErrorResponse` on failure:
```json
{
  "success": false,
  "error": "Error description",
  "code": 422,
  "details": null
}
```

Common error codes:
- `401`: Missing or invalid bearer token
- `403`: Insufficient role (not SUPERADMIN/ADMIN)
- `422`: Validation error (invalid dates, out-of-range values)
- `500`: Internal server error
