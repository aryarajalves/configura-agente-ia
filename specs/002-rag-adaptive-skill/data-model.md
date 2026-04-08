# Data Model: RAG Adaptativo & Biblioteca de Habilidades

## Entities

### Skill
- **Description**: Core knowledge object representing a reusable skill accessible by agents.
- **Fields**:
  - `id` (UUID)
  - `name` (string)
  - `description` (string)
  - `type` (enum: documental, hibrida)
  - `status` (enum: draft, active, archived)
  - `active_version_id` (UUID, nullable)
  - `created_at`, `updated_at`

### SkillVersion
- **Description**: A version snapshot for a skill, isolating processing state and content from the active runtime version.
- **Fields**:
  - `id` (UUID)
  - `skill_id` (UUID)
  - `version_number` (integer)
  - `status` (enum: processing, active, attention, error)
  - `source_count` (integer)
  - `processed_at` (timestamp, nullable)
  - `activated_at` (timestamp, nullable)
  - `error_message` (text, nullable)
  - `created_at`, `updated_at`

### SkillSource
- **Description**: Uploaded document or external content reference associated with a skill version.
- **Fields**:
  - `id` (UUID)
  - `skill_version_id` (UUID)
  - `source_type` (enum: pdf, txt, excel, csv, audio, video)
  - `source_uri` (string)
  - `filename` (string)
  - `metadata` (JSONB)
  - `checksum` (string)
  - `created_at`, `updated_at`

### VectorChunk
- **Description**: Semantic chunk stored in pgvector with explicit product linkage.
- **Fields**:
  - `id` (UUID)
  - `skill_version_id` (UUID)
  - `skill_source_id` (UUID)
  - `content` (text)
  - `embedding` (vector)
  - `product_id` (string)
  - `chunk_hash` (string)
  - `created_at`, `updated_at`

### ProductTable
- **Description**: Volatile relational store for live product data.
- **Expected fields**:
  - `product_id` (string, primary key)
  - `price` (numeric)
  - `stock` (integer)
  - other product details as needed

## Relationships

- `SkillVersion` belongs to `Skill`.
- `SkillSource` belongs to `SkillVersion`.
- `VectorChunk` belongs to `SkillVersion` and `SkillSource`.
- `VectorChunk.product_id` joins to `ProductTable.product_id` for hybrid query enrichment.
- `Skill.active_version_id` points to the current runtime version for the skill.

## Validation Rules

- `VectorChunk` must include `product_id` for hybrid skills.
- `SkillVersion` may be `attention` when one or more chunks lack valid `product_id` metadata.
- `SkillVersion` must preserve the prior active version until a new version reaches `active` status.
- `VectorChunk` should enforce a unique constraint on `(skill_version_id, product_id, chunk_hash)` to prevent duplicate ingestion within the same skill version.

## State Transition

- `draft` → `processing` when ingestion starts.
- `processing` → `active` when ingestion completes successfully and is validated.
- `processing` → `attention` when product linkage is incomplete or requires manual mapping.
- `processing` → `error` when ingestion fails and requires retry.
- `active` → `archived` when the skill is retired.
