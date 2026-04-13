# Research: Infraestrutura e Deploy Local

## RabbitMQ Custom Dockerfile
- **Pesquisa**: O requisito 13 da especificação pede uma imagem baseada no backend.
- **Decisão**: Criar `backend/rabbitmq.Dockerfile` usando `rabbitmq:3-management` como base para permitir futuras personalizações (plugins, configs) mantendo o controle no repositório de backend.
- **Rationale**: Segue a diretriz do usuário de centralizar a definição de imagem.

## Docker Compose Include
- **Pesquisa**: A diretiva `include` permite importar serviços, redes e volumes de outros arquivos compose.
- **Decisão**: No `infra/docker-compose-local.yml`, usaremos `include: - docker-compose-db-local.yml`. 
- **Rationale**: Isso importa o serviço `postgres` permitindo que o `backend` use `depends_on: postgres`.

## Rede network_swarm_public
- **Pesquisa**: O Docker Compose cria redes automaticamente se não forem marcadas como `external`.
- **Decisão**: Alterar a definição da rede para remover `external: true` no modo local, garantindo que o `docker-compose up` crie a rede se ela não existir.
- **Rationale**: Atende ao pedido de "garantir que a rede seja criada automaticamente".
