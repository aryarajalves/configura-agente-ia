# Feature Specification: RAG Adaptativo & Biblioteca de Habilidades

**Feature Branch**: `002-rag-adaptive-skill`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "RAG Adaptativo & Biblioteca de Habilidades"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar habilidade híbrida (Priority: P1)

Um Admin de conhecimento cria uma nova habilidade híbrida que combina documentos com dados relacionais.

**Why this priority**: Esta jornada é a porta de entrada para a nova biblioteca de habilidades e habilita a ingestão de conteúdo multimodal com vínculo entre texto e dados de produto.

**Independent Test**: Um testador Admin verifica a criação de uma habilidade híbrida carregando documentos e selecionando uma tabela Postgres sem depender de agentes existentes.

**Acceptance Scenarios**:

1. **Given** que sou um Admin na Biblioteca de Conhecimento, **When** eu seleciono "Nova Habilidade" e escolho o tipo "Híbrido", **Then** o sistema deve permitir o upload de documentos (PDF/TXT/Excel/CSV) e a seleção de uma tabela dinâmica no Postgres, incluindo a coluna `product_id` ou equivalente para vincular os dados relacionais.
2. **Given** que a habilidade híbrida foi criada, **When** eu envio arquivos válidos para ingestão, **Then** o sistema deve iniciar o processamento assíncrono e atualizar o status da habilidade em tempo real.

---

### User Story 2 - Resposta híbrida por product_id (Priority: P2)

Um usuário final faz uma pergunta e recebe resposta que combina contexto semântico e dados de produto.

**Why this priority**: O valor central da habilidade híbrida é a capacidade de responder com informação de RAG e dados relacionais unidos pelo mesmo `product_id`.

**Independent Test**: Um testador pergunta por um preço de produto e verifica que a resposta incluiu contexto do documento e valor obtido do banco de dados.

**Acceptance Scenarios**:

1. **Given** que um documento foi indexado com metadados de `product_id`, **When** o usuário pergunta o preço de um item, **Then** o Agente deve recuperar o contexto relevante do RAG e realizar uma query no Postgres usando o `product_id` correspondente para formular a resposta final.
2. **Given** que o `product_id` está presente no contexto do RAG, **When** a consulta é executada, **Then** o sistema deve retornar dados do Postgres para o preço e disponibilidade sempre que o ID existir.

---

### User Story 3 - Versionamento estável de habilidade (Priority: P3)

Uma habilidade em uso é atualizada sem interromper o comportamento do Agente até a nova versão estar pronta.

**Why this priority**: Garantir estabilidade operacional ao atualizar uma habilidade evita respostas inconsistentes e protege agentes ativos durante o reprocessamento.

**Independent Test**: Um testador adiciona novos arquivos a uma habilidade já vinculada a um agente e valida que o agente continua usando a versão anterior até o processamento ser concluído.

**Acceptance Scenarios**:

1. **Given** que uma Habilidade já está vinculada a um Agente ativo, **When** eu adiciono novos arquivos para processamento via TaskIQ, **Then** o Agente deve continuar respondendo com a versão estável anterior até que o novo processamento seja concluído e validado.
2. **Given** que o processamento assíncrono falha, **When** o status é atualizado, **Then** a versão anterior permanece ativa e o sistema permite reprocessar a habilidade.

---

### Edge Cases

- **ID não encontrado no PDF**: O sistema marca o status como "Atenção" e solicita que o Admin aponte manualmente o `product_id` no Postgres para aquele trecho.
- **Falha no TaskIQ (vídeo/PDF pesado)**: O status muda para "Erro", preserva a versão anterior da base e permite a tentativa de reprocessamento (Retry).
- **Conflito de ID Duplicado**: O sistema deve impedir a indexação e alertar que o `product_id` já possui uma fonte de dados conflitante na mesma Habilidade.
- **product_id ausente no contexto**: O sistema deve retornar uma resposta clara de falta de dados relacionais e permitir que o usuário refine a pergunta ou o Admin informe o ID.- **Tabela Postgres sem coluna `product_id` válida**: O sistema deve impedir a criação da habilidade ou exigir uma coluna compatível antes de iniciar o processamento.
## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow the creation and management of knowledge skills that are independent from specific agents.
- **FR-002**: System MUST support ingestion of PDF, TXT, Excel, CSV and audio/video transcription sources into a knowledge skill.
- **FR-003**: System MUST implement hybrid retrieval by combining semantic vector search with relational Postgres lookup using `product_id`.
- **FR-004**: System MUST use asynchronous TaskIQ processing for ingestion and provide real-time status updates in the interface.
- **FR-005**: System MUST store `product_id` metadata with each generated vector chunk.
- **FR-006**: System MUST keep the current stable version active for agent responses until new processing completes and is validated.
- **FR-007**: System MUST detect and block duplicate `product_id` conflicts inside the same skill, surfacing a clear error to the Admin.
- **FR-008**: System MUST preserve prior stable data when processing fails and allow manual retry after error resolution.
- **FR-009**: System MUST support manual or semi-automatic mapping from ingested source metadata to the selected relational `product_id` column when automatic extraction is not possible.
- **FR-010**: System MUST support transcription ingestion for audio/video sources through TaskIQ.

### Key Entities *(include if feature involves data)*

- **Habilidade (Skill)**: A knowledge object that contains metadata, a type (documental or híbrida), version status, and links to source content.
- **Documento/Fonte**: Uploaded files or external content paths that are processed into chunks and indexed into the knowledge skill.
- **Vetor (Embedding)**: A semantic chunk representation stored in the vector index and associated with `product_id` metadata.
- **Tabela Volátil**: A relational Postgres table with fields such as `price`, `stock` and `product_id` used for live data enrichment.
- **Versão de Habilidade**: The active validated version of a skill and the pending version under processing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Switching the active skill version after processing completion takes less than 2 seconds.
- **SC-002**: 100% of hybrid queries that include a valid `product_id` in RAG context must return relational data from Postgres when available.
- **SC-003**: An Admin can create a hybrid skill, upload documents, and select a Postgres table in a single workflow without requiring a separate agent change.
- **SC-004**: Any TaskIQ processing failure must preserve the prior stable version and expose an error state with a retry path.
- **SC-005**: Duplicate `product_id` conflicts inside the same skill must be detected and blocked before completion of indexing.

## Assumptions

- Admin users have access to the knowledge library interface and relevant Postgres table selection controls.
- Existing agents can route queries through the hybrid retrieval flow once the skill is published.
- TaskIQ is available for asynchronous ingestion and status propagation.
- `product_id` is the primary join key between vector metadata and relational product records.
- Initial scope focuses on hybrid skill creation, ingestion, versioning, and retrieval; advanced product matching or OCR-based ID extraction is out of scope for this feature.
