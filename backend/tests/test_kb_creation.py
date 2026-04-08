import requests
import sys

payload = {
    "name": "Test Script Base",
    "description": "testing kb_type",
    "kb_type": "product"
}

headers = {
    "X-API-Key": "a0c10372-af47-4a36-932a-9b1acdb59366"
}

try:
    resp = requests.post("http://localhost:8002/knowledge-bases", json=payload, headers=headers)
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())
except Exception as e:
    print("Error:", e)
