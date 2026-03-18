from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import json
import os
import sys

sys.path.append("/app")
from models import InteractionLog, AgentConfigModel
from database import DATABASE_URL

SYNC_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
engine = create_engine(SYNC_URL)
Session = sessionmaker(bind=engine)
session = Session()

def get_interaction_details(log_id):
    log = session.get(InteractionLog, log_id)
    if not log:
        return {"error": "Interaction not found"}
    
    agent = session.get(AgentConfigModel, log.agent_id)
    
    # Try to parse debug_info if it's JSON string
    debug = {}
    if log.debug_info:
        try:
            debug = json.loads(log.debug_info)
        except:
            debug = {"raw": log.debug_info}
            
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat(),
        "agent_name": agent.name if agent else "Unknown",
        "system_prompt_len": len(agent.system_prompt) if agent else 0,
        "user_message": log.user_message,
        "agent_response": log.agent_response,
        "tokens_in": log.input_tokens,
        "tokens_out": log.output_tokens,
        "model": log.model_used,
        "debug": debug
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        log_id = int(sys.argv[1])
        details = get_interaction_details(log_id)
        print(json.dumps(details, indent=2, ensure_ascii=False))
    else:
        print("Usage: python analyze_interaction.py <log_id>")
