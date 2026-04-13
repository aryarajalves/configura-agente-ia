# Implementation Plan - Corrigir Deploy do Backend e Infraestrutura

**Feature Branch**: `008-fix-implementation-regressions`  
**Status**: Planning  
**User Request**: Corrigir o deploy no `infra/docker-compose-local.yml` onde o backend não está funcionando (travado esperando o banco). Aplicar as diretrizes de clarificação (include, Dockerfile customizado para RabbitMQ, rede automática).

## Technical Context

O deploy local atual falha porque o `backend` depende do `postgres`, mas o serviço de banco está em um arquivo separado (`docker-compose-db-local.yml`) e não há integração automática entre eles. Além disso, o RabbitMQ está usando uma imagem genérica enquanto o requisito pede uma imagem baseada no contexto do backend.

### Constraints & Assumptions
- **Include**: Usar a diretiva `include` do Docker Compose v2.20+ para importar o banco de dados.
- **RabbitMQ**: Criar um `Dockerfile` para o RabbitMQ dentro de `backend/rabbitmq.Dockerfile`.
- **Rede**: A rede `network_swarm_public` deve ser do tipo `bridge` e criada automaticamente se não existir no ambiente local.
- **Dependência**: O `backend` deve ter um `depends_on` explícito para o `postgres` (importado via include).

### Unknowns (NEEDS CLARIFICATION -> Phase 0)
- [x] Configuração exata do `Dockerfile` do RabbitMQ.
- [x] Sintaxe do `include` para arquivos em diretórios relativos.

## Constitution Check

| Principle | Status | Notes |
| :--- | :--- | :--- |
| I. Canonical Tech Stack | ✅ | Mantendo FastAPI, RabbitMQ e Postgres. |
| IV. Performance & Resilience | ✅ | Healthchecks garantirão que o backend só suba com infra pronta. |
| VIII. UX/UI Integrity | ✅ | Logs do Docker estarão limpos e estruturados. |

## Phase 0: Outline & Research

1. **Research Task 1**: Validar se o `include` do Docker Compose suporta arquivos que usam redes externas ou se é melhor converter para redes internas gerenciadas.
2. **Research Task 2**: Definir o conteúdo do `backend/rabbitmq.Dockerfile` para suportar os requisitos (provavelmente rabbitmq:3-management + algum config).

## Phase 1: Design & Contracts

### Data Model
Nenhuma alteração no modelo de dados relacionais.

### Interface Contracts
Ajuste nas portas e nomes de host:
- `postgres` (serviço importado) acessível na rede interna como `postgres`.
- `rabbitmq` (serviço local) acessível como `rabbitmq`.

## Phase 2: Implementation Steps

### Step 1: RabbitMQ Custom Dockerfile
- Criar `backend/rabbitmq.Dockerfile`.
- Ajustar `docker-compose-local.yml` para usar o build desse Dockerfile.

### Step 2: Ajuste do Docker Compose Local
- Adicionar `include: - docker-compose-db-local.yml`.
- Ajustar `networks` para não ser `external: true` se quisermos que seja criada automaticamente, OU manter `external: true` e usar `name` se for pré-requisito, mas a clarificação pediu "garantir que a rede seja criada automaticamente". Portanto, removeremos `external: true` e usaremos rede gerenciada.

### Step 3: Conexão Frontend -> Backend
- Ajustar `VITE_API_URL` no `frontend` service para apontar para o host correto.

## Verification Plan

### Automated Tests
- N/A para infra (exceto se houver scripts de validação).

### Manual Verification
1. `docker compose -f infra/docker-compose-local.yml up -d`
2. Verificar se o container `postgres` subiu automaticamente.
3. Verificar se o `backend` saiu do loop de espera por banco.
4. Testar acesso à API em `localhost:8000`.
