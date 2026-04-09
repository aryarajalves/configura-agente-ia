# Quickstart: Ingestão de Dados & Gestão de Nuvem

Este guia descreve como configurar e testar o worker de upload para Backblaze B2.

## Pré-requisitos
1. **Credenciais B2**: Configure em seu `.env`:
   ```env
   B2_KEY_ID=seu_id
   B2_APPLICATION_KEY=sua_chave
   B2_BUCKET_NAME=fluxai-ingestion
   ```
2. **TaskIQ & RabbitMQ**: Certifique-se de que o RabbitMQ está rodando e os workers estão ativos.
   ```bash
   taskiq worker backend.core.tkq:broker
   ```

## Fluxo de Teste (Mock)

### 1. Simular Ingestão
Envie um arquivo para o endpoint de upload:
```bash
curl -X POST -F "file=@grande_video.mp4" http://localhost:8000/api/v1/ingestion/upload
```

### 2. Acompanhar no Terminal (Logs do Worker)
O worker deve exibir:
- `[INFO] Iniciando upload para B2: grande_video.mp4`
- `[INFO] Hash calculado: sha256_da_alegria`
- `[INFO] Upload concluído. Iniciando processamento de IA.`

### 3. Verificar Dashboard de Background
Acesse `/admin/background` para ver o card em tempo real.

## Troubleshooting
- **Fila bloqueada**: Lembre-se que o processamento de IA é limitado a 1 por vez. Se houver muitos arquivos, eles ficarão em `Enfileirado`.
- **Erro de Conexão B2**: Verifique se o bucket é privado e as chaves têm permissão de `writeFile` e `deleteFile`.
