# 🤖 Plataforma de Agentes de IA para Automação

Esta é uma solução completa para criação, gerenciamento e treinamento de agentes de IA personalizados, integrando RAG (Retrieval-Augmented Generation), automação de calendário e ferramentas de fine-tuning.

---

## 🏗️ Estrutura do Ecossistema

-   **Backend:** FastAPI com PostgreSQL (SQLAlchemy + pgvector).
-   **Frontend:** Dashboard Admin em React + Vite.
-   **Database:** PostgreSQL 15 com suporte a vetores para busca semântica.
-   **Infra:** Dockerizada para fácil deploy e escalabilidade.

---

## 🚀 Como Iniciar (Setup Local)

### 1. Requisitos
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/install/) instalados.

### 2. Configuração de Variáveis
Crie um arquivo `.env` na raiz do projeto:

```env
OPENAI_API_KEY=sua_chave_aqui
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ai_agent_db
POSTGRES_PORT_EXTERNAL=5433
```

### 3. Rodar a Aplicação
Suba os containers em modo de desenvolvimento:

```bash
docker-compose -f docker/docker-compose-local.yml up -d --build
```

- **Frontend:** [http://localhost:5300](http://localhost:5300)
- **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Suíte de Testes

Para garantir a estabilidade do sistema, execute os testes unitários e de integração dentro do container:

```bash
# Rodar todos os testes
docker exec -e PYTHONPATH=/app backend-agente-local pytest

# Rodar testes específicos (ex: RAG)
docker exec -e PYTHONPATH=/app backend-agente-local pytest tests/test_rag_unit.py
```

---

## 📦 Deploy e Imagens Docker

### Backend
1. **Build:** `docker build -t aryarajalves/configurar-agentes-ia:1.1.0-backend ./backend`
2. **Push:** `docker push aryarajalves/configurar-agentes-ia:1.1.0-backend`

### Frontend
1. **Build:** `docker build --target production -t aryarajalves/configurar-agentes-ia:1.1.0-frontend ./frontend`
2. **Push:** `docker push aryarajalves/configurar-agentes-ia:1.1.0-frontend`

---

## 📂 Organização de Pastas
- `/backend`: Lógica central, APIs e **suíte de testes**.
- `/frontend`: Dashboard e Interface do Usuário.
- `/docs`: Planos de implementação e evoluções (Arquivado).
- `/widget`: Script para integração do chat em sites externos.
