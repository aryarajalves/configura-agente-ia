---
description: Diretrizes para criação e manutenção do arquivo requirements.txt
---

# 📦 Protocolo de Gerenciamento do requirements.txt (MANDATÓRIO)

Toda vez que você for criar, editar ou adicionar dependências ao arquivo `requirements.txt`, você **DEVE** seguir as regras abaixo sem exceção.

---

## 1. Sempre Liste com Versão Fixa

Toda biblioteca **DEVE** ter a versão explícita usando `==`. Nunca deixe uma dependência sem versão.

```
# ❌ ERRADO - Nunca faça isso
fastapi
sqlalchemy
openai

# ✅ CORRETO - Sempre fixe a versão
fastapi==0.115.8
sqlalchemy==2.0.38
openai==1.63.2
```

**Exceções raras:** Use `>=` ou `<` **somente** quando houver uma razão técnica documentada, como incompatibilidade entre versões (ex: `bcrypt<5.0.0` por quebra de compatibilidade com passlib).

---

## 2. Organize por Categorias com Comentários

Agrupe as bibliotecas por função/propósito e adicione um **comentário explicativo** acima de cada grupo. Dentro de cada grupo, ordene alfabeticamente.

```
# === Framework Web e API ===
fastapi==0.115.8          # Framework async para construção de APIs REST
starlette==0.45.3         # Base HTTP do FastAPI (dependência direta)
uvicorn==0.34.0           # Servidor ASGI para rodar o FastAPI
gunicorn==23.0.0          # Gerenciador de workers para produção

# === Banco de Dados ===
asyncpg==0.30.0           # Driver async para PostgreSQL
sqlalchemy==2.0.38        # ORM para modelagem e queries SQL
psycopg2-binary==2.9.10   # Driver sync para PostgreSQL (usado em scripts)
pgvector==0.3.6           # Extensão para vetores no PostgreSQL (embeddings)

# === Autenticação e Segurança ===
python-jose[cryptography] # Geração e validação de tokens JWT
passlib[bcrypt]           # Hashing seguro de senhas
bcrypt<5.0.0              # Pin para compatibilidade com passlib (v5 quebrou a API)
slowapi                   # Rate limiting para proteção contra abuso

# === IA e Machine Learning ===
openai==1.63.2            # SDK oficial da OpenAI (GPT, embeddings, fine-tuning)
tiktoken==0.9.0           # Tokenizador para contar tokens antes de enviar à API
scikit-learn              # Algoritmos de ML para classificação e similaridade
```

---

## 3. Cada Biblioteca DEVE Ter um Comentário Inline

Use `#` após a versão para explicar **o que é** e **por que está sendo usada**. Seja conciso mas informativo.

```
# ✅ BOM - Explica o que faz e por quê
httpx==0.28.1             # Cliente HTTP async para chamadas a webhooks e APIs externas
pdfplumber==0.11.5        # Extração de texto de PDFs para importação na knowledge base

# ❌ RUIM - Comentário genérico ou ausente
httpx==0.28.1             # Biblioteca HTTP
pdfplumber==0.11.5
```

---

## 4. Documente Pins e Restrições Especiais

Se uma biblioteca tem restrição de versão (`<`, `>=`, `!=`), **DEVE** haver um comentário explicando o motivo:

```
bcrypt<5.0.0              # Pin obrigatório: v5.0 quebrou compatibilidade com passlib (rejeita senhas longas)
scipy>=1.11.0             # Mínimo requerido pelo scikit-learn para sparse arrays
```

---

## 5. Antes de Adicionar uma Nova Dependência

Sempre que for adicionar uma biblioteca nova:

1. **Verifique se já existe** no requirements.txt (não duplique)
2. **Identifique a versão exata** instalada no container com `pip show <pacote>`
3. **Adicione na categoria correta** com comentário explicativo
4. **Teste a instalação** rodando `pip install -r requirements.txt` no container

---

## 6. Modelo de Referência

Use este modelo como base ao criar um novo `requirements.txt`:

```
# === Framework Web e API ===
fastapi==0.115.8          # Framework async de alta performance para APIs REST
starlette==0.45.3         # Framework HTTP base do FastAPI
uvicorn==0.34.0           # Servidor ASGI para desenvolvimento e produção
gunicorn==23.0.0          # Process manager para deploy com múltiplos workers

# === Banco de Dados ===
asyncpg==0.30.0           # Driver PostgreSQL assíncrono (usado pelo SQLAlchemy async)
sqlalchemy==2.0.38        # ORM principal do projeto (async + sync)
psycopg2-binary==2.9.10   # Driver PostgreSQL síncrono (scripts de migração)

# === Autenticação e Segurança ===
python-jose[cryptography] # JWT tokens para autenticação de usuários
passlib[bcrypt]           # Hash de senhas com bcrypt
bcrypt<5.0.0              # Compatibilidade com passlib (v5 quebra API de senhas longas)
slowapi                   # Rate limiting por IP nas rotas da API

# === IA e Processamento ===
openai==1.63.2            # SDK OpenAI para chat completions e embeddings
tiktoken==0.9.0           # Contagem de tokens para controle de custo

# === Utilitários ===
python-dotenv==1.0.1      # Leitura de variáveis de ambiente do arquivo .env
httpx==0.28.1             # Cliente HTTP assíncrono para webhooks e integrações
```

---

*Este documento é a fonte da verdade para padronização de dependências Python no projeto.*
