# Guia de Variáveis de Ambiente (Stacks)

Este documento explica as variáveis necessárias para configurar o projeto no **Portainer** ou via **Docker Compose**.

## 🌐 Frontend (VITE)

Essas variáveis são usadas pelo navegador para saber como se comunicar com o servidor.

| Variável | Descrição | Valor Sugerido (Produção) |
| :--- | :--- | :--- |
| **VITE_API_URL** | Endereço público da sua API (Backend). | `https://api.seudominio.com` |
| **VITE_AGENT_API_KEY** | Chave de segurança para validar requisições do frontend. | Deve ser IGUAL à `AGENT_API_KEY` do Backend. |

---

## ⚙️ Backend (API)

Variáveis principais para o funcionamento da inteligência e do banco de dados.

| Variável | Descrição |
| :--- | :--- |
| **OPENAI_API_KEY** | Sua chave da OpenAI (usada para GPT-4o e Embeddings). |
| **GEMINI_API_KEY** | Sua chave do Google Gemini (opcional, se usar modelos Gemini). |
| **AGENT_API_KEY** | Chave mestra de segurança da API. (Ex: `a0c10372-af47-4a36-932a-9b1acdb59366`) |
| **JWT_SECRET_KEY** | Chave aleatória para criptografar os tokens de login. |
| **ADMIN_EMAIL** | Email que será usado para o primeiro login no painel. |
| **ADMIN_PASSWORD** | Senha inicial do administrador. |

---

## 🐘 Banco de Dados (Postgres)

Configurações de conexão interna entre os containers.

| Variável | Descrição |
| :--- | :--- |
| **POSTGRES_USER** | Usuário do banco (padrão: `postgres`). |
| **POSTGRES_PASSWORD** | Senha do banco (padrão: `postgres`). |
| **POSTGRES_DB** | Nome do banco de dados (padrão: `ai_agent_db`). |

---

> [!IMPORTANT]
> No Portainer, as chaves **VITE_API_URL** e **VITE_AGENT_API_KEY** devem estar presentes na stack do **Frontend**. Se você estiver testando localmente, o `VITE_API_URL` costuma ser `http://localhost:8002`.
