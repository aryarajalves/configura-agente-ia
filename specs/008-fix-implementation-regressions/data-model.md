# Data Model: Reversão e Estabilidade

## Entities

### KnowledgeBase (formerly Skill)
- **Table**: `knowledge_bases`
- **Fields**:
  - `id`: UUID (Primary Key)
  - `name`: String
  - `description`: String
  - `type`: Enum (documental, hibrida)
  - `status`: Enum (draft, active, archived)
  - `active_version_id`: UUID (FK to `knowledge_base_versions`)
  - `created_at`, `updated_at`

### KnowledgeBaseVersion
- **Table**: `knowledge_base_versions`
- **Fields**:
  - `id`: UUID
  - `knowledge_base_id`: UUID (FK)
  - `version_number`: Integer
  - `status`: Enum (processing, active, attention, error)
  - `source_count`: Integer
  - `processed_at`, `activated_at`
  - `error_message`: Text

### KnowledgeBaseSource
- **Table**: `knowledge_base_sources`
- **Fields**:
  - `id`: UUID
  - `knowledge_base_version_id`: UUID (FK)
  - `source_type`: Enum (pdf, txt, excel, csv, audio, video)
  - `source_uri`: String
  - `filename`: String
  - `metadata`: JSON
  - `checksum`: String

### Admin (User Management)
- **Table**: `admins`
- **Status**: Mantido conforme existente, mas suporte a listagem completa adicionado na API.

## Relationships
- Um **Agente** pode possuir múltiplas **KnowledgeBases** vinculadas (via tabela associativa ou campo metadata).
- Uma **KnowledgeBase** possui múltiplas **KnowledgeBaseVersions**.
- Uma **KnowledgeBaseVersion** possui múltiplas **KnowledgeBaseSources**.
