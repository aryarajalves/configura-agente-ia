
import json
import uuid

def test_logic(text):
    preview_items = []
    is_structured_json = False
    try:
        data = json.loads(text)
        if isinstance(data, list):
            for entry in data:
                if isinstance(entry, dict) and "context" in entry and isinstance(entry["context"], list):
                    is_structured_json = True
                    for item in entry["context"]:
                        if isinstance(item, dict) and ("metadata" in item or "metadata_val" in item) and "context" in item:
                            m_val = item.get("metadata_val", item.get("metadata", ""))
                            preview_items.append({
                                "id": str(uuid.uuid4()),
                                "type": "structured_json",
                                "metadata_val": m_val,
                                "question": item.get("question", m_val),
                                "answer": item.get("context", item.get("answer", "")),
                                "category": "Importação Estruturada",
                                "selected": True
                            })
    except Exception as e:
        print(f"Error: {e}")
    
    return is_structured_json, preview_items

structured_json = [
    {
        "context": [
            {
                "metadata_val": "Test Metadata",
                "context": "Test Content"
            }
        ]
    }
]

text = json.dumps(structured_json)
res, items = test_logic(text)
print(f"Result: {res}")
print(f"Items: {items}")
