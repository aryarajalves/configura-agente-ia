# Guia de Operação e Produção - AI Agent System

Este guia contém os comandos e configurações necessários para manter o sistema rodando em produção.

## 🚀 URLs de Produção
- **Backend:** `https://agenteback.aryaraj.shop`
- **Frontend:** `https://agente.aryaraj.shop`

## 🛠️ Pipeline de Build e Push (Local -> Docker Hub)

Sempre que realizar alterações no código, execute os comandos abaixo para atualizar as imagens no servidor.

### 1. Build do Backend
```bash
docker build -t aryarajalves/configurar-agentes-ia:1.0.0 ./backend
```

### 2. Build do Frontend (Configurado para Producão)
O frontend precisa da URL da API embutida no momento do build.
```bash
docker build --build-arg VITE_API_URL=https://agenteback.aryaraj.shop --build-arg VITE_AGENT_API_KEY=a0c10372-af47-4a36-932a-9b1acdb59366 -t aryarajalves/configurar-agentes-ia:1.0.0-frontend -f ./frontend/Dockerfile.prod ./frontend
```

### 3. Enviar para o Docker Hub
```bash
docker push aryarajalves/configurar-agentes-ia:1.0.0
docker push aryarajalves/configurar-agentes-ia:1.0.0-frontend
```

## 🚢 Deploy no Servidor (Docker Swarm)

Após fazer o push das imagens, acesse o seu servidor via SSH e execute:

```bash
docker stack deploy -c docker-compose-producao.yml agentes
```

Para forçar a atualização dos containers com as novas imagens:
```bash
docker service update --image aryarajalves/configurar-agentes-ia:1.0.0 agentes_backend
docker service update --image aryarajalves/configurar-agentes-ia:1.0.0-frontend agentes_frontend
```

## 📝 Notas de Versão Recentes
- **Chave de Retorno:** O backend agora retorna tanto `response` quanto `content` para manter compatibilidade com o n8n.
- **Variáveis Globais:** Sistema de injeção de contexto ativo e gerenciável via Dashboard.
- **Estabilidade:** Correção de conflitos de argumentos na inicialização do Gunicorn.

## 📦 Imagens Atuais
- `aryarajalves/configurar-agentes-ia:1.0.0`
- `aryarajalves/configurar-agentes-ia:1.0.0-frontend`
