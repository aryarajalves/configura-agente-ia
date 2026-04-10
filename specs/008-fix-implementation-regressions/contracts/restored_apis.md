# Protocolo de API: Rotas Restauradas

Este documento define os contratos das rotas que foram restauradas ou criadas para compatibilidade com o frontend.

## 1. Conhecimento
- **`GET /v1/knowledge-bases`**
  - **Descrição**: Lista todas as bases de conhecimento (ex-skills).
  - **Resposta (200 OK)**:
    ```json
    {
      "status": "success",
      "data": [
        {
          "id": "uuid",
          "name": "Nome da Base",
          "description": "...",
          "type": "documental",
          "status": "active"
        }
      ]
    }
    ```

## 2. Modelos e Ferramentas
- **`GET /v1/models`**
  - **Descrição**: Lista modelos LLM disponíveis.
  - **Resposta (200 OK)**:
    ```json
    {
      "status": "success",
      "data": ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "gemini-1.5-pro"]
    }
    ```

- **`GET /v1/tools`**
  - **Descrição**: Lista ferramentas (functions) disponíveis para os agentes.
  - **Resposta (200 OK)**:
    ```json
    {
      "status": "success",
      "data": []
    }
    ```

## 3. Gestão e Financeiro
- **`GET /v1/users`**
  - **Descrição**: Lista administradores do sistema.
  - **Resposta (200 OK)**:
    ```json
    {
      "status": "success",
      "data": []
    }
    ```

- **`GET /v1/financial/report`**
  - **Descrição**: Relatório financeiro detalhado por período (Alias para `/v1/finance/summary`).
  - **Query Params**: `start_date`, `end_date`
  - **Resposta (200 OK)**:
    ```json
    {
      "status": "success",
      "data": {
        "total_cost": 0.0,
        "records": []
      }
    }
    ```

## 4. Integrações
- **`GET /v1/integrations/google/status`**
  - **Descrição**: Status da integração com Google Calendar/Gmail.
  - **Resposta (200 OK)**:
    ```json
    {
      "status": "success",
      "data": { "connected": false }
    }
    ```
