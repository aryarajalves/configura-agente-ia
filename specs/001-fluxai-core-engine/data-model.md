# Data Model: Motor FluxAI

## Entities

### Agent
Representa a configuração central de um agente de IA.
- `id`: UUID (Primary Key, Shared with Vector DB)
- `name`: String
- `superadmin_id`: UUID (Foreign Key to Admin/SUPERADMIN)
- `status`: Enum (DRAFT, ACTIVE, INACTIVE)
- `is_locked`: Boolean (Global edit lock)
- `model_fast_id`: String (Reference to Model Catalog)
- `model_analytic_id`: String (Reference to Model Catalog)
- `model_fallback_id`: String (Reference to Model Catalog)
- `routing_thresholds`: JSONB (Admin-defined thresholds, e.g., max_words, keywords)
- `rules_config`: JSONB (Blacklist, Competitors, DoubleCheck toggle)
- `created_at`: DateTime
- `updated_at`: DateTime
- `deleted_at`: DateTime (Soft Delete)

### Admin
Usuários administrativos do sistema.
- `id`: UUID
- `email`: String (Unique)
- `password_hash`: String
- `role`: Enum (SUPERADMIN, ADMIN)
- `created_at`: DateTime
- `deleted_at`: DateTime (Soft Delete)

### AuditLog
Registro imutável de alterações e violações.
- `id`: BigInt
- `agent_id`: UUID (Index)
- `admin_id`: UUID (Nullable, for config changes)
- `session_id`: String (Nullable, for interaction violations)
- `event_type`: Enum (CONFIG_CHANGE, SECURITY_VIOLATION, FALLBACK_TRIGGERED)
- `payload`: JSONB (Before/After values or violation details)
- `timestamp`: DateTime

### Session
Estado de conversação efêmero (persistido via PostgresSaver para LangGraph).
- `thread_id`: String (Primary Key)
- `agent_id`: UUID
- `user_id`: String (External user identifier)
- `checkpoint`: Binary/JSONB (LangGraph state)
- `loop_counter`: Integer
- `metadata`: JSONB (SLA tracking, usage metrics)

## Relationships

- **Agent 1:N AuditLog**: Um agente tem muitos logs de auditoria.
- **SUPERADMIN 1:N Agent**: Um SUPERADMIN cria e possui controle total sobre múltiplos agentes.
- **Agent 1:N Session**: Um agente processa múltiplas sessões de usuários.
- **SUPERADMIN 1:N All**: O papel SUPERADMIN possui acesso irrestrito a todos os agentes e logs da plataforma.
