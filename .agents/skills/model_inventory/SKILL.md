# AI Model Inventory Skill (v2 - Otimizada)

Esta skill fornece um inventário técnico e financeiro otimizado de modelos de IA, focando em estabilidade e controle de custos.

## Uso

O Antigravity deve consultar esta skill ou as diretrizes derivadas dela sempre que precisar de:
1. IDs de modelo para chamadas de API (campo `request_id`).
2. Cálculos de custos (campos `in_1M` e `out_1M` em USD).
3. Capacidades do modelo (context window e parâmetros suportados).

## Inventário Otimizado (Principal)

| Provedor | Modelo Comercial | request_id (ID Estático) | Entrada (1M) | Saída (1M) | Contexto |
| :--- | :--- | :--- | :--- | :--- | :--- |
| OpenAI | GPT-5.2 Flagship | `gpt-5.2-2026-01-20` | $1.75 | $14.00 | 128k |
| OpenAI | GPT-5.1 Mini | `gpt-5.1-mini-2026-02-10` | $0.30 | $2.10 | 128k |
| OpenAI | GPT-5 | `gpt-5-2025-11-15` | $1.50 | $12.00 | 128k |
| OpenAI | GPT-4.1 Turbo | `gpt-4.1-turbo-2025-09-30` | $1.00 | $8.00 | 128k |
| OpenAI | GPT-4o Mini | `gpt-4o-mini-2024-07-18` | $0.15 | $0.60 | 128k |
| OpenAI | GPT-4o | `gpt-4o-2024-08-06` | $2.50 | $10.00 | 128k |
| Google | Gemini 3.1 Pro | `gemini-3.1-pro-001` | $2.00 | $12.00 | 2M |
| Google | Gemini 3.1 Flash | `gemini-3.1-flash-001` | $0.50 | $3.00 | 1M |
| Google | Gemini 2.5 Pro | `gemini-2.5-pro-v2-002` | $1.25 | $10.00 | 2M |
| Google | Gemini 2.5 Flash | `gemini-2.5-flash-v2-001` | $0.30 | $2.50 | 1M |

> [!IMPORTANT]
> O modelo **GPT-5.2 Pro** foi removido deste inventário para evitar custos excessivos inesperados em processos automatizados.
