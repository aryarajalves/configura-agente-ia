#!/bin/sh
set -e

# Garante que binários instalados via pip estejam no PATH
export PATH="/usr/local/bin:$PATH"

echo "⏳ Aguardando o banco de dados ficar disponível..."

# Extrai host e porta da DATABASE_URL (formato: postgresql+asyncpg://user:pass@host:port/db)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_PORT=${DB_PORT:-5432}

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
  echo "   Banco não disponível ainda, tentando novamente em 2s..."
  sleep 2
done

echo "✅ Banco de dados disponível."

# ---- Roteamento de comandos ----
case "$1" in
  worker)
    echo "⏭️ Pulando migrações (Serviço Worker Identificado)..."
    echo "🚀 Iniciando TaskIQ Worker..."
    exec python -m taskiq worker broker:broker tasks
    ;;
  scheduler)
    echo "⏭️ Pulando migrações (Serviço Scheduler Identificado)..."
    echo "🚀 Iniciando TaskIQ Scheduler..."
    exec python -m taskiq scheduler broker:scheduler
    ;;
  *)
    # Serviço principal (backend / API)
    echo "🛠️ Verificando/Criando banco de dados se necessário..."
    python -c "import asyncio; import models; from database import init_db; asyncio.run(init_db())"

    echo "🔄 Rodando migrações (alembic upgrade head)..."
    python -c "from alembic.config import main; main(argv=['upgrade', 'head'])"
    echo "✅ Migrações concluídas."

    if [ $# -gt 0 ]; then
        echo "🚀 Executando comando recebido: $@"
        exec "$@"
    else
        echo "🚀 Iniciando aplicação web..."
        exec python -m gunicorn main:app -w "${GUNICORN_WORKERS:-4}" -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --timeout "${GUNICORN_TIMEOUT:-120}"
    fi
    ;;
esac
