# Quickstart - Infraestrutura FluxAI Local

Para subir o ambiente de desenvolvimento local atualizado:

1. Certifique-se de que o arquivo `.env` está configurado corretamente na raiz.
2. Execute o comando:
   ```bash
   docker compose -f infra/docker-compose-local.yml up --build
   ```

**O que mudou:**
- Agora o banco de dados é importado automaticamente via `include`.
- O RabbitMQ usa um Dockerfile customizado localizado em `backend/`.
- A rede `network_swarm_public` é criada automaticamente (tipo bridge) se não existir.
- O backend aguarda explicitamente o banco estar saudável antes de iniciar.
