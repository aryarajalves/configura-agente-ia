import logging
import re

logger = logging.getLogger(__name__)

class SecurityService:
    @staticmethod
    def check_blacklist(text: str, blacklist: list) -> bool:
        """
        Checks if any forbidden keywords are present in the text.
        (FR-012: Blacklist filtering)
        """
        for word in blacklist:
            if re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE):
                logger.warning(f"Security Alert: Forbidden word '{word}' detected.")
                return True
        return False

    @staticmethod
    async def double_check_ai(text: str, agent_config: dict) -> str:
        """
        Simulates a second pass check by a faster/safety model.
        (FR-013: Double Check IA)
        """
        if not agent_config.get("double_check"):
            return text
        
        # In a real scenario, this would call a safety LLM.
        # Here we just mock it.
        logger.info("Performing Double Check IA pass...")
        if "offensive" in text.lower():
            return "Message blocked by safety guardlines."
        
        return text
