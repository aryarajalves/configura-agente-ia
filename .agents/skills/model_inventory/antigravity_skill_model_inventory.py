from antigravity.skills import Skill, Result

class AIModelOptimizedSkill(Skill):
    """
    Inventário técnico e financeiro otimizado. 
    Removido GPT-5.2 Pro para evitar custos excessivos em automações.
    NOTA: Todos os valores 'in_1M' e 'out_1M' estão em DÓLARES (USD).
    """
    
    name = "get_ai_model_inventory_v2"
    description = "Retorna IDs estáticos, janelas de contexto, parâmetros e custos em USD."

    def run(self) -> Result:
        model_inventory = {
            "currency": "USD",
            "google_gemini": {
                "gemini_3.1_pro": {
                    "request_id": "gemini-3.1-pro-001",
                    "context_window": "2,000,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "TopK"],
                    "in_1M": 2.00, "out_1M": 12.00
                },
                "gemini_3.1_flash": {
                    "request_id": "gemini-3.1-flash-001",
                    "context_window": "1,000,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "TopK"],
                    "in_1M": 0.50, "out_1M": 3.00
                },
                "gemini_2.5_pro": {
                    "request_id": "gemini-2.5-pro-v2-002",
                    "context_window": "2,000,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "TopK"],
                    "in_1M": 1.25, "out_1M": 10.00
                },
                "gemini_2.5_flash": {
                    "request_id": "gemini-2.5-flash-v2-001",
                    "context_window": "1,000,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "TopK"],
                    "in_1M": 0.30, "out_1M": 2.50
                }
            },
            "openai_gpt": {
                "gpt_5.2_flagship": {
                    "request_id": "gpt-5.2-2026-01-20",
                    "context_window": "128,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP"],
                    "in_1M": 1.75, "out_1M": 14.00
                },
                "gpt_5.1_mini": {
                    "request_id": "gpt-5.1-mini-2026-02-10",
                    "context_window": "128,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "Presence Penalty", "Frequency Penalty"],
                    "in_1M": 0.30, "out_1M": 2.10
                },
                "gpt_5": {
                    "request_id": "gpt-5-2025-11-15",
                    "context_window": "128,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "Presence Penalty", "Frequency Penalty"],
                    "in_1M": 1.50, "out_1M": 12.00
                },
                "gpt_4.1_turbo": {
                    "request_id": "gpt-4.1-turbo-2025-09-30",
                    "context_window": "128,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "Presence Penalty", "Frequency Penalty"],
                    "in_1M": 1.00, "out_1M": 8.00
                },
                "gpt_4o_mini": {
                    "request_id": "gpt-4o-mini-2024-07-18",
                    "context_window": "128,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "Presence Penalty", "Frequency Penalty"],
                    "in_1M": 0.15, "out_1M": 0.60
                },
                "gpt_4o": {
                    "request_id": "gpt-4o-2024-08-06",
                    "context_window": "128,000",
                    "tool_use": True,
                    "params": ["Temperature", "TopP", "Presence Penalty", "Frequency Penalty"],
                    "in_1M": 2.50, "out_1M": 10.00
                }
            }
        }
        
        return Result.success(model_inventory)
