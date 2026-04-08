# Data Model: Performance & Aprimoramento (Módulo 3)

## Key Entities

### StressTest_Persona
- **id**: UUID / primary key
- **name**: string
- **description**: string
- **behavior_config**: JSONB (persona prompts, tone, escalation rules)
- **created_at**: timestamp
- **updated_at**: timestamp

**Example behavior_config JSON:**
```json
{
  "prompt_template": "You are a {tone} customer who is frustrated with {topic}. Respond aggressively and demand immediate resolution.",
  "tone": "aggressive",
  "escalation_rules": ["if no response in 5 minutes, repeat demand", "use all caps for emphasis"],
  "fallback_responses": ["This is unacceptable!", "I demand to speak to a manager."]
}
```

### StressTest_Session
- **id**: UUID / primary key
- **persona_id**: UUID → StressTest_Persona.id
- **persona_snapshot**: JSONB (record of the persona config used for this session)
- **status**: enum(`queued`, `processing`, `success`, `error`, `timeout`)
- **progress_percentage**: int
- **taskiq_task_id**: string
- **relatorio_md_link**: text
- **started_at**: timestamp
- **finished_at**: timestamp
- **error_message**: text
- **created_by**: UUID / user reference
- **created_at**: timestamp
- **updated_at**: timestamp

### Inbox_Item
- **id**: UUID / primary key
- **pergunta_original**: text
- **falha_detectada**: text
- **sugestao_ia**: text
- **resposta_final_usuario**: text
- **frequencia_erro**: int
- **status**: enum(`pendente`, `resolvido`, `descartado`, `bloqueado`)
- **group_id**: UUID / nullable (grouping key for similar failures based on string similarity)
- **blocked**: boolean
- **discarded**: boolean
- **resolver_id**: UUID / user reference
- **knowledge_version_id**: UUID / optional reference to RAG version snapshot
- **created_at**: timestamp
- **updated_at**: timestamp

### BackgroundTask
- **id**: UUID / primary key
- **tipo**: enum(`ingestao`, `stresstest`)
- **taskiq_task_id**: string
- **related_session_id**: UUID / nullable → StressTest_Session.id
- **related_inbox_item_id**: UUID / nullable → Inbox_Item.id
- **status**: enum(`queued`, `processing`, `success`, `error`, `timeout`)
- **progresso**: int
- **log_tecnico**: text
- **timestamp_inicio**: timestamp
- **timestamp_fim**: timestamp
- **created_at**: timestamp
- **updated_at**: timestamp

## Relationships

- A `StressTest_Session` references `StressTest_Persona` and may generate multiple `Inbox_Item` records.
- A `BackgroundTask` can relate to a `StressTest_Session` or an `Inbox_Item` for traceability.
- `Inbox_Item` groups use `group_id` to express clustering by string similarity and repeated impact.

## Notes

- `persona_snapshot` preserves the persona configuration at runtime so historical Stress Test results remain reproducible.
- `knowledge_version_id` supports the feature requirement to update the RAG knowledge base without taking the agent offline.
- `frequencia_erro` is incremented as duplicate or similar failures are grouped for prioritized curatorial review.
