# Quickstart: Correção de Regressões

## Pré-requisitos
- Docker & Docker Compose instalados.
- Ambiente Python 3.11+ e Node.js configurados para testes locais.

## Passos para Validação

### 1. Aplicar Migrations de Reversão
No diretório `backend/src`:
```bash
alembic upgrade head
```
(Certifique-se de que a migration de renomeação `skills` -> `knowledge_bases` já foi gerada e está no topo).

### 2. Validar Sidebar
- Inicie o frontend e o backend.
- Verifique se o menu lateral exibe "Bases de Conhecimento" e "Fine-Tuning".
- Teste o redirecionamento para `/knowledge-bases` e `/fine-tuning`.

### 3. Testar Persistência de Sessão
- Faça login.
- Recarregue a página ou aguarde um período para garantir que o Cookie persiste e você não é deslogado.

### 4. Verificar Rotas de API
- Verifique no console do navegador se as chamadas para `/v1/models`, `/v1/users`, etc., agora retornam 200 OK em vez de 404.

### 5. Criação de Agente
- Vá para `/agent/new`.
- Tente salvar o agente e verifique se o erro "Field required" foi mitigado pela validação correta dos campos.
