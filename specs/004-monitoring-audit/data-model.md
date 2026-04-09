# Data Model: Monitorização e Auditoria (Módulo 4)

## AuditLog

- **Table**: `audit_logs`
- **Purpose**: Registra alterações críticas em agentes, habilidades e usuários.
- **Fields**:
  - `id`: UUID, PK
  - `agent_id`: UUID, FK para `agents.id`
  - `superadmin_id`: UUID, FK para `admins.id`
  - `action`: string, tipo de operação realizada
  - `target_entity_type`: string, ex: `agent`, `skill`, `user`, `system_settings`
  - `target_entity_id`: UUID, opcional, referência genérica ao recurso afetado
  - `previous_state`: JSON, estado antes da alteração
  - `new_state`: JSON, estado após a alteração
  - `timestamp`: DateTime
  - `deleted_user_display`: string, opcional, `Nome (Removido)` para usuários excluídos

## FinancialRecord

- **Table**: `financial_records`
- **Purpose**: Armazena os custos por agente e habilidade para o dashboard financeiro.
- **Fields**:
  - `id`: UUID, PK
  - `agent_id`: UUID, FK para `agents.id`
  - `skill_id`: UUID, FK para `skills.id`
  - `token_count`: integer
  - `estimated_cost`: numeric
  - `type`: enum(`chat`, `fine_tuning`, `ingestion`)
  - `period_start`: DateTime
  - `period_end`: DateTime
  - `created_at`: DateTime

## SystemSettings

- **Table**: `system_settings`
- **Purpose**: Persiste as políticas de governança e alertas de armazenamento.
- **Fields**:
  - `id`: UUID, PK
  - `retention_period_days`: integer
  - `storage_threshold_alert`: integer
  - `last_cleanup_timestamp`: DateTime
  - `updated_by`: UUID, FK para `admins.id`
  - `updated_at`: DateTime

## RetentionTask / CleanupJob

- **Table**: `cleanup_jobs`
- **Purpose**: Rastreia execução de tarefas de remoção de dados e falhas consecutivas.
- **Fields**:
  - `id`: UUID, PK
  - `task_name`: string, ex: `cleanup_audit_logs`
  - `status`: enum(`pending`, `running`, `success`, `failed`)
  - `last_run_at`: DateTime
  - `failure_count`: integer
  - `error_message`: string, nullable
  - `created_at`: DateTime
  - `updated_at`: DateTime

## ContainerHealthMetric

- **Table**: `container_health_metrics`
- **Purpose**: Armazena métricas históricas de uso de disco e memória do contêiner.
- **Fields**:
  - `id`: UUID, PK
  - `disk_usage_percent`: numeric
  - `memory_usage_percent`: numeric
  - `timestamp`: DateTime
  - `container_id`: string, opcional

## Relationships

- `AuditLog.agent_id` → `agents.id`
- `AuditLog.superadmin_id` → `admins.id`
- `FinancialRecord.agent_id` → `agents.id`
- `FinancialRecord.skill_id` → `skills.id`
- `SystemSettings.updated_by` → `admins.id`

## Notes

- The existing `backend/src/models/audit.py` already defines `AuditLog` and can be extended for `target_entity_type` and `target_entity_id`.
- `cleanup_jobs` is a lightweight task state table intended for governance alerts and retry logic, not for storing every single deleted record.
- `financial_records` should support both summary and per-agent detail queries for charts and CSV export.
