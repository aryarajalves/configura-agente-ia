import os
import httpx
import logging

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "mock-key")

    async def call_model(self, model_id: str, messages: list, timeout: int = 30) -> str:
        """
        Generic wrapper for LLM calls with timeout support.
        (FR-001/FR-002: Dual-brain execution, FR-003: Fallback)
        """
        import asyncio
        
        logger.info(f"Calling model {model_id} with {len(messages)} messages, timeout={timeout}s")
        
        try:
            # simulated delay to test fallback if timeout=8
            # await asyncio.sleep(10) # Uncomment to force fallback
            
            if "gpt-4" in model_id:
                return f"[ANALYTIC] Simulated response from {model_id}."
            else:
                return f"[FAST] Simulated response from {model_id}."
        except asyncio.TimeoutError:
            logger.error(f"Model {model_id} timed out after {timeout}s")
            raise

llm_service = LLMService()
