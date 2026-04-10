"""
skill_service.py — DEPRECATED.
Kept for backward compatibility only.
All new code should use knowledge_base_service.KnowledgeBaseService.
"""
from src.services.knowledge_base_service import KnowledgeBaseService as SkillService

# Make SkillService importable
__all__ = ["SkillService"]

