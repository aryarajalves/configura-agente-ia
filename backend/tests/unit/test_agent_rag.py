
import httpx
import asyncio
import json

async def test_agent():
    url = "http://localhost:8000/execute"
    payload = {
        "message": "Me fale sobre os preços e valores dos seus serviços de mentoria ou consultas disponíveis na base de conhecimento.",
        "agent_id": 1,
        "session_id": "test_session_rag_full",
        "context_variables": {
            "contact_name": "Antigravity Tester",
            "contact_phone": "5511999999999"
        }
    }
    headers = {
        "X-API-Key": "a0c10"
    }
    
    print(f"Enviando mensagem: {payload['message']}")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers, timeout=60.0)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print("--- RESULTADO ---")
                print("Resposta:", data.get("response")[:100] + "...")
                print("Custo BRL:", data.get("cost_brl"))
                
                debug = data.get("debug", {})
                print("RAG Skipped?", debug.get("rag_skipped"))
                if debug.get("rag_skipped"):
                    print("Motivo Bypass:", debug.get("rag_skip_reason"))
                
                print("Itens RAG encontrados:", len(debug.get("rag_items", [])))
                
                # Check metrics for mini/main
                # The response object from /execute in main.py doesn't return mini vs main tokens yet in the top level JSON,
                # but we can see it in the terminal logs (docker logs)
                print("\nVerifique os 'docker logs backend-agente-local' para ver o detalhamento por modelo.")
            else:
                print("Erro:", response.text)
        except Exception as e:
            print(f"Falha na requisição: {e}")

if __name__ == "__main__":
    asyncio.run(test_agent())
