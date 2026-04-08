
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, delete
import openai
import os
import json

from database import get_db
from models import InteractionLog, SessionSummary, AgentConfigModel

router = APIRouter()

class BatchExtractRequest(BaseModel):
    session_ids: List[str]

@router.post("/sessions/questions/batch")
async def extract_questions_batch(request: BatchExtractRequest, db: AsyncSession = Depends(get_db)):
    if not request.session_ids:
        return {"questions": []}
        
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured")

    # Fetch user messages from these sessions
    # Limit to reasonable amount to avoid context overflow
    # Ordered by time desc to get most recent relevant interactions
    query = (
        select(InteractionLog.user_message)
        .where(
            InteractionLog.session_id.in_(request.session_ids),
            InteractionLog.user_message != None,
            InteractionLog.user_message != ""
        )
        .order_by(InteractionLog.timestamp.desc())
        .limit(200) # Safety limit
    )
    
    result = await db.execute(query)
    messages = result.scalars().all()
    
    if not messages:
        return {"questions": []}
        
    # Prepare prompt
    text_blob = "\n".join([f"- {m}" for m in messages if len(str(m)) > 2]) # Relaxed filter
    
    system_prompt = """
    Você é um analista de dados de conversas. 
    Sua tarefa é extrair PERGUNTAS DISTINTAS e RELEVANTES feitas pelos usuários nesta lista de mensagens.
    
    Regras:
    1. Ignore cumprimentos ou frases sem conteúdo (ex: "oi", "bom dia").
    2. Identifique perguntas explícitas (com ?) e implícitas (ex: "gostaria de saber o preço").
    3. Retorne apenas a lista de perguntas, uma por linha.
    4. Se houver perguntas muito similares, agrupe em uma única versão clara.
    5. O resultado DEVE ser um objeto JSON com a chave "questions": {"questions": ["pergunta 1", "pergunta 2"]}
    """
    
    try:
        client = openai.Client(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Mensagens para analisar:\n\n{text_blob}"}
            ],
            temperature=0.3,
            response_format={ "type": "json_object" }
        )
        
        content = response.choices[0].message.content
        data = json.loads(content)
        questions = data.get("questions", [])
        
        # Fallback if specific key not returned but list is inside
        if not questions and isinstance(data, list):
            questions = data
            
        # Ensure it's a list of strings
        if isinstance(questions, list):
             return {"questions": [str(q) for q in questions]}
        
        return {"questions": []}
        
    except Exception as e:
        print(f"Error extracting questions: {e}")
        # Fallback simplistic extraction if LLM fails
        simple_questions = [m for m in messages if "?" in str(m) and len(str(m)) > 10]
        return {"questions": list(set(simple_questions))[:20]}
