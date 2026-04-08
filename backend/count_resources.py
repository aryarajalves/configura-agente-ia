from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import AgentConfigModel, KnowledgeBaseModel, KnowledgeItemModel
from database import DATABASE_URL

engine = create_engine(DATABASE_URL.replace('postgresql+asyncpg', 'postgresql'))
Session = sessionmaker(bind=engine)
session = Session()

def count_agent_resources(agent_id):
    agent = session.get(AgentConfigModel, agent_id)
    print(f"Agent Name: {agent.name}")
    print(f"System Prompt Chars: {len(agent.system_prompt)}")
    
    kb_count = len(agent.knowledge_bases)
    print(f"Knowledge Bases: {kb_count}")
    
    total_items = 0
    for kb in agent.knowledge_bases:
        total_items += len(kb.items)
        print(f"  - KB: {kb.name} ({len(kb.items)} items)")
    
    print(f"Total Knowledge Items Linked: {total_items}")

if __name__ == "__main__":
    count_agent_resources(4)
