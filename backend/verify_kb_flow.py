import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_kb_flow():
    print("🚀 Starting Knowledge Base Flow Verification...")

    # 1. Create Knowledge Base
    print("\n1. Creating Knowledge Base...")
    kb_payload = {
        "name": "Test KB for Automacao",
        "description": "A temporary base to test the flow."
    }
    res = requests.post(f"{BASE_URL}/knowledge-bases", json=kb_payload)
    if res.status_code != 200:
        print(f"❌ Failed to create KB: {res.text}")
        return
    kb = res.json()
    kb_id = kb['id']
    print(f"✅ KB Created: ID {kb_id} - {kb['name']}")

    # 2. Add Item
    print(f"\n2. Adding Item to KB {kb_id}...")
    item_payload = {
        "question": "O que é o projeto Antigravity?",
        "answer": "Antigravity é um projeto de agente de IA avançado para automação."
    }
    res = requests.post(f"{BASE_URL}/knowledge-bases/{kb_id}/items", json=item_payload)
    if res.status_code != 200:
        print(f"❌ Failed to add item: {res.text}")
        return
    item = res.json()
    print(f"✅ Item Added: ID {item['id']}")

    # 3. Create Agent Linked to KB
    print(f"\n3. Creating Agent linked to KB {kb_id}...")
    agent_payload = {
        "name": "Agent KB Tester",
        "description": "Testing the KB link.",
        "model": "gpt-3.5-turbo",
        "knowledge_base_id": kb_id
    }
    res = requests.post(f"{BASE_URL}/agents", json=agent_payload)
    if res.status_code != 200:
        print(f"❌ Failed to create Agent: {res.text}")
        return
    agent = res.json()
    agent_id = agent['id']
    print(f"✅ Agent Created: ID {agent_id} - Linked to KB {agent['knowledge_base_id']}")

    # 4. Verify Link in Agent Config Fetch
    print(f"\n4. Verifying Agent Config...")
    res = requests.get(f"{BASE_URL}/agents/{agent_id}")
    fetched_agent = res.json()
    if fetched_agent['knowledge_base_id'] == kb_id:
        print("✅ Link confirmed in Fetch.")
    else:
        print(f"❌ Link mismatch: {fetched_agent.get('knowledge_base_id')}")

    # 5. Execute Agent (Simulation)
    # We won't make a real call to OpenAI if we can avoid it, but the API will try.
    # We primarily want to see if the backend log shows the merge.
    print(f"\n5. Triggering Execution (Check backend logs for 'Merged' message)...")
    msg_payload = {
        "message": "O que é Antigravity?",
        "agent_id": agent_id
    }
    # This might fail if OpenAI key is invalid or quota exceeded, but we care about the log before that
    try:
        requests.post(f"{BASE_URL}/execute", json=msg_payload, timeout=5) 
        print("✅ Execution request sent.")
    except Exception as e:
        print(f"⚠️ Execution request finished (possibly timed out or error): {e}")

    # 6. Cleanup
    print("\n6. Cleaning up...")
    requests.delete(f"{BASE_URL}/agents/{agent_id}")
    requests.delete(f"{BASE_URL}/knowledge-bases/{kb_id}")
    print("✅ Cleanup complete.")

if __name__ == "__main__":
    test_kb_flow()
