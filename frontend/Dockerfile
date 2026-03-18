# --- DOCKERFILE UNIFICADO (MULTI-ESTÁGIO) ---
# Este arquivo único gerencia tanto o ambiente de desenvolvimento quanto o de produção.

# -------------------------------------------------------------
# ESTÁGIO 1: Base (Dependências Comuns)
# Este estágio prepara o terreno para todos os outros.
# -------------------------------------------------------------
FROM node:20-slim AS base
WORKDIR /app

# Copia e prepara o entrypoint logo no início (disponível para todos os estágios baseados em node)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY package*.json ./
RUN npm install
COPY . .

# Garante que o entrypoint seja executado para gerar o config.js em dev
ENTRYPOINT ["/entrypoint.sh"]

# -------------------------------------------------------------
# ESTÁGIO 2: Desenvolvimento (Modo Interativo com Hot Reload)
# -------------------------------------------------------------
FROM base AS development
EXPOSE 5173
# --host é crucial para o Docker aceitar conexões externas ao container
CMD ["npm", "run", "dev", "--", "--host"]

# -------------------------------------------------------------
# ESTÁGIO 3: Builder (Geração dos arquivos estáticos)
# -------------------------------------------------------------
FROM base AS builder
# Executa o build (ignorando o entrypoint se necessário via override, mas aqui ele roda e gera o config.js que não será usado pelo build do vite)
RUN npm run build

# -------------------------------------------------------------
# ESTÁGIO 4: Produção (Nginx Leve servindo o site pronto)
# -------------------------------------------------------------
FROM nginx:1.25-alpine AS production

# Root do Nginx
WORKDIR /usr/share/nginx/html

# Limpa config padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copia nossa config customizada (SPA Routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia o bundle gerado pelo estágio builder
COPY --from=builder /app/dist .

# Re-copia o entrypoint aqui pois o Nginx não herda do estágio 'base'
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
