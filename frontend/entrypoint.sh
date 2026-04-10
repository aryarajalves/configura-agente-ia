#!/bin/sh

# Função para ler segredos do Docker e exportar como variáveis de ambiente
load_secrets() {
    if [ -f "/run/secrets/VITE_API_URL" ]; then
        export VITE_API_URL=$(cat /run/secrets/VITE_API_URL)
        echo "✅ VITE_API_URL carregada do Secret"
    fi
    if [ -f "/run/secrets/VITE_AGENT_API_KEY" ]; then
        export VITE_AGENT_API_KEY=$(cat /run/secrets/VITE_AGENT_API_KEY)
        echo "✅ VITE_AGENT_API_KEY carregada do Secret"
    fi
}

# Função para substituir variáveis de ambiente em arquivos JS e HTML
replace_env_vars() {
    if [ ! -d "/usr/share/nginx/html" ]; then
        echo "⚠️ /usr/share/nginx/html não encontrado. Pulando substituição de variáveis de ambiente no código estático."
        return
    fi

    echo "🔍 Substituindo variáveis de ambiente em /usr/share/nginx/html..."
    # Lista de arquivos para processar
    FILES=$(find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.html" \))

    for file in $FILES; do
        # Substitui VITE_API_URL
        if [ -n "$VITE_API_URL" ]; then
            # Remove barra final se houver
            CLEAN_URL=$(echo $VITE_API_URL | sed 's|/*$||')
            # Busca por localhost:8000 (padrão de build) ou pelo PLACEHOLDER
            sed -i "s|http://localhost:8000|$CLEAN_URL|g" "$file"
            sed -i "s|VITE_API_URL_PLACEHOLDER|$CLEAN_URL|g" "$file"
        fi

        # Substitui VITE_AGENT_API_KEY
        if [ -n "$VITE_AGENT_API_KEY" ]; then
            sed -i "s|VITE_AGENT_API_KEY_PLACEHOLDER|$VITE_AGENT_API_KEY|g" "$file"
        fi
    done
}

echo "🚀 Iniciando frontend..."

# 1. Carrega os segredos do Portainer
load_secrets

# 2. Executa a substituição das variáveis no código estático
echo "📍 API URL Final: ${VITE_API_URL:-'Não encontrada'}"
replace_env_vars

# 3. Executa o comando passado para o container (CMD)
exec "$@"
