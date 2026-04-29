from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
import json
import os
import sys

# In the container, /app is the backend directory
sys.path.append("/app")
from models import InteractionLog, AgentConfigModel
from database import DATABASE_URL

# Sync URL for SQLAlchemy sync session
SYNC_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")

engine = create_engine(SYNC_URL)
Session = sessionmaker(bind=engine)
session = Session()

def list_recent_interactions(limit=10):
    stmt = select(InteractionLog).order_by(InteractionLog.timestamp.desc()).limit(limit)
    logs = session.execute(stmt).scalars().all()
    
    results = []
    for log in logs:
        # Fetch agent name from session
        agent = session.query(AgentConfigModel).filter(AgentConfigModel.id == log.agent_id).first()
        agent_name = agent.name if agent else "Desconhecido"
        
        results.append({
            "id": log.id,
            "agent": agent_name,
            "session_id": log.session_id,
            "msg": log.user_message[:50] + "..." if log.user_message else "",
            "tokens_in": log.input_tokens,
            "tokens_out": log.output_tokens,
            "timestamp": log.timestamp.isoformat()
        })
    return results

if __name__ == "__main__":
    interactions = list_recent_interactions()
    print(json.dumps(interactions, indent=2, ensure_ascii=False))
