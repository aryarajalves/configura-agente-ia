---
description: Diretrizes mandatórias para alteração de modelos de IA e lógica de processamento
---

# ⚠️ PROTOCOLO DE CONHECIMENTO DE MODELOS (MANDATÓRIO)

Toda vez que você for realizar qualquer alteração nos modelos de IA, lógica de fallback, precificação de tokens ou qualquer coisa relacionada à inteligência artificial neste projeto, você **DEVE** seguir as diretrizes abaixo.

### 1. Não presuma Versões (Cutoff)
Sua base de conhecimento interna sobre o "último lançamento da OpenAI ou Google" está defasada para os padrões deste projeto. **NUNCA** presuma que os modelos que você conhece são os mais novos.

### 2. Descoberta Dinâmica de Modelos (Sistema Automático)
Os IDs reais dos modelos são **descobertos automaticamente** via APIs da OpenAI e Google Gemini. O `config_store.py` contém:

- **`MODEL_INFO`**: Dicionário de referência com **famílias** de modelos. Define QUAIS modelos mostrar no dropdown e seus **preços/capacidades** (que as APIs NÃO fornecem). As chaves são nomes de família (ex: `gpt-5.2`, `gemini-3.1-pro`).
- **`discover_models()`**: Função que chama as APIs reais, descobre os IDs disponíveis, e cruza com MODEL_INFO. Cache de 1 hora.
- **`get_real_model_id(family)`**: Resolve um nome de família para o ID real da API.
- **`get_model_pricing(model)`**: Busca preço por nome ou prefixo.

**IMPORTANTE:** Nunca hardcode IDs de modelo no código (ex: `gpt-5.2-2025-12-11`). Use os nomes de família (`gpt-5.2`) e deixe o sistema resolver dinamicamente.

### 3. Famílias de Modelos Disponíveis (Referência de preços)

| Família | Provedor | Custo (in/out 1M) | Contexto |
| :--- | :--- | :--- | :--- |
| **gpt-5.2** | OpenAI | $1.75 / $14.00 | 128k |
| **gpt-5-mini** | OpenAI | $0.30 / $2.10 | 128k |
| **gpt-5** | OpenAI | $1.50 / $12.00 | 128k |
| **gpt-4.1** | OpenAI | $1.00 / $8.00 | 128k |
| **gpt-4o-mini** | OpenAI | $0.15 / $0.60 | 128k |
| **gpt-4o** | OpenAI | $2.50 / $10.00 | 128k |
| **gemini-3.1-pro** | Google | $2.00 / $12.00 | 2M |
| **gemini-3.1-flash** | Google | $0.50 / $3.00 | 1M |
| **gemini-2.5-pro** | Google | $1.25 / $10.00 | 2M |
| **gemini-2.5-flash** | Google | $0.30 / $2.50 | 1M |

### 4. Lógica de Tradução e Inventário
- **Skill de Referência:** Sempre que for mexer em `backend/config_store.py` ou `backend/agent.py`, consulte esta diretriz.
- **Preços:** Os custos por 1M de tokens devem ser verificados nas páginas oficiais de pricing. As APIs NÃO fornecem preços.
- **IDs Reais:** São resolvidos automaticamente por `get_real_model_id()`. Nunca hardcoded.
- **Novas Famílias:** Para adicionar um modelo novo, basta adicionar uma entrada no `MODEL_INFO` com o prefixo da família.

### 5. Hierarquia de Fallback (3 Níveis)
O `agent.py` usa uma hierarquia de 3 níveis para garantir continuidade:

1. **🟢 Principal** (`config.model`) — Modelo configurado pelo usuário
2. **🟡 Fallback** (`config.fallback_model`) — Modelo de contingência configurado
3. **🔴 Emergência** (`gpt-4o-mini` hardcoded) — Último recurso, sempre funciona

Regra: Se o modelo principal for **OpenAI**, configure o fallback como **Google Gemini** (e vice-versa).

---
*Este documento é a fonte da verdade para o estado atual da IA no projeto.*
