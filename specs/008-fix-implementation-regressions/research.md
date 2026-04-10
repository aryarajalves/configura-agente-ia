# Research: Correção de Regressões e Estabilidade

## Decisions

### 1. Reversão de Nomenclatura (Skills -> Knowledge Bases)
- **Decision**: Renomeação física de tabelas e colunas no banco de dados.
- **Rationale**: O usuário solicitou explicitamente que "tudo o que tenha relação com o banco de dados" volte ao nome original para evitar confusão.
- **Implementation**: Migration Alembic para renomear `skills` -> `knowledge_bases` e arquivos relacionados.

### 2. Restauração de Rotas de API
- **Decision**: Criar novos endpoints no backend para suprir as 404s do frontend.
- **Rationale**: O frontend legado ou em transição espera rotas específicas que foram removidas ou renomeadas no processo de refatoração para "Skills".
- **Routes to add**:
  - `GET /v1/knowledge-bases` (Alias para skills)
  - `GET /v1/models`
  - `GET /v1/fine-tuning/models`
  - `GET /v1/integrations/google/status`
  - `GET /v1/tools`
  - `GET /v1/financial/report`
  - `GET /v1/users`

### 3. Persistência de Sessão
- **Decision**: Uso de Cookies `HttpOnly` com expiração de longo prazo (ou sem expiração configurada no client-side).
- **Rationale**: Atender ao requisito de "login sem limite" uma vez que o usuário esteja conectado.
- **Implementation**: Ajustar `auth_service.py` para emitir cookies de longa duração e garantir que o middleware valide corretamente.

### 4. Correção de Erros de Script (TypeError)
- **Decision**: Implementar fallbacks de arrays vazios `[]` em todos os endpoints que retornam listas.
- **Rationale**: Erros como `kbList.filter is not a function` ocorrem quando a API retorna `null` ou um erro em um campo esperado como lista.

### 5. Infraestrutura RabbitMQ
- **Decision**: Sincronizar a imagem do RabbitMQ no `docker-compose-local.yml` com a base do backend.
- **Rationale**: Pedido específico do usuário para padronização de imagens (SC-13).

## Alternatives Considered
- **Frontend-only mapping**: Rejeitado pois o usuário quer consistência no banco de dados.
- **Compatibility Layers (Aliasing only)**: Rejeitado em favor de restauração completa das rotas para manter a funcionalidade dos módulos (Financeiro, Usuários).
