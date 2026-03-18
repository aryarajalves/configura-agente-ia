#!/bin/sh

# Função para ler segredo ou variável de ambiente
# Prioridade: /run/secrets/NOME > Variável de Ambiente NOME
get_value() {
    var_name=$1
    if [ -f "/run/secrets/$var_name" ]; then
        cat "/run/secrets/$var_name"
    else
        eval echo "\$$var_name"
    fi
}

# Determina o diretório de saída
if [ -d "/usr/share/nginx/html" ]; then
    # Produção (Nginx)
    CONFIG_DIR="/usr/share/nginx/html"
else
    # Desenvolvimento (Vite - geralmente montado em /app)
    # Se a pasta public existir, salva nela, senão na raiz
    if [ -d "/app/public" ]; then
        CONFIG_DIR="/app/public"
    else
        CONFIG_DIR="/app"
    fi
fi

CONFIG_FILE="$CONFIG_DIR/config.js"


# Recupera os valores priorizando secrets
API_URL=$(get_value "VITE_API_URL")
AGENT_API_KEY=$(get_value "VITE_AGENT_API_KEY")

# Garante que API_URL sempre tenha o protocolo https://
case "$API_URL" in
  http://*|https://*) ;;
  *) API_URL="https://$API_URL" ;;
esac

echo "window.configs = {" > $CONFIG_FILE
echo "  VITE_API_URL: \"${API_URL}\"," >> $CONFIG_FILE
echo "  VITE_AGENT_API_KEY: \"${AGENT_API_KEY}\"" >> $CONFIG_FILE
echo "};" >> $CONFIG_FILE

echo "Arquivo config.js gerado com as seguintes variáveis (valores ocultos por segurança):"
echo "VITE_API_URL detectado: ${API_URL}"

# Inicia o Nginx (comando original do container)
exec "$@"

