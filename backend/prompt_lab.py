
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import openai

router = APIRouter()

class PromptRequest(BaseModel):
    identity: str
    mission: str
    tone: str
    audience: str
    restrictions: str

@router.post("/generate-prompt")
async def generate_prompt(request: PromptRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured")

    system_instruction = """
    Você é um Engenheiro de Prompts Sênior especializado em criar Personas para Agentes de IA Profissionais.
    Sua missão é transformar inputs do usuário em um SYSTEM PROMPT dividido em 4 MACRO-BLOCOS obrigatórios:

    1. # PERSONA (Quem a IA é? Detalhes psicológicos, tom de autoridade).
    2. # TOM DE VOZ (Como ela fala? Formalidade, uso de gírias, brevidade).
    3. # REGRAS E LIMITAÇÕES (O que ela NUNCA deve fazer? Limites éticos e comportamentais).
    4. # CONTEXTO E INSTRUÇÕES GERAIS (Como ela deve agir em situações específicas e o contexto do negócio).

    DIRETRIZES:
    - Use Markdown para formatar.
    - O prompt final deve estar em Português do Brasil.
    - Seja criativo e transforme ideias simples em diretrizes de alto desempenho.
    - Mantenha a separação clara entre os 4 blocos acima.
    """

    user_input = f"""
    Crie um System Prompt profissional com base nestes dados brutos:
    
    - IDENTIDADE: {request.identity}
    - MISSÃO: {request.mission}
    - TOM DE VOZ: {request.tone}
    - PÚBLICO ALVO: {request.audience}
    - RESTRIÇÕES: {request.restrictions}
    """

    try:
        client = openai.Client(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_input}
            ]
        )
        
        return {"prompt": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PublishRequest(BaseModel):
    prompt: str

@router.patch("/agents/{agent_id}/publish")
async def publish_prompt(agent_id: int, request: PublishRequest):
    from database import get_db
    from models import AgentConfigModel
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    
    # We need to get a DB session manually because we are inside a router but want to keep it simple
    from database import SessionLocal
    async with SessionLocal() as db:
        result = await db.execute(select(AgentConfigModel).where(AgentConfigModel.id == agent_id))
        db_config = result.scalars().first()
        
        if not db_config:
            raise HTTPException(status_code=404, detail="Agente não encontrado")
            
        db_config.system_prompt = request.prompt
        await db.commit()
        
        return {"message": f"Prompt publicado com sucesso no agente {db_config.name}!"}

class ChatRequest(BaseModel):
    current_prompt: str
    messages: list[dict] # [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]

@router.post("/prompt-chat")
async def prompt_chat(request: ChatRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured")

    system_instruction = f"""
    Você é um Consultor Estratégico de Prompts. Seu objetivo é ajudar o usuário a planejar e ajustar o prompt do Agente de IA.
    
    PROMPT ATUAL DO AGENTE:
    ---
    {request.current_prompt}
    ---
    
    INSTRUÇÕES:
    1. Não altere o prompt ainda. Apenas converse com o usuário sobre o que ele quer mudar ou melhorar.
    2. Dê sugestões críticas: o que está faltando? Como deixar mais persuasivo ou técnico?
    3. Seja breve e consultivo.
    """

    messages = [{"role": "system", "content": system_instruction}] + request.messages

    try:
        client = openai.Client(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7
        )
        return {"content": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/apply-suggestions")
async def apply_suggestions(request: ChatRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key not configured")

    chat_summary = "\n".join([f"{m['role']}: {m['content']}" for m in request.messages])

    system_instruction = """
    Você é um Engenheiro de Prompts Sênior. Sua missão é REESCREVER e MELHORAR o System Prompt do Agente com base em toda a conversa anterior.
    
    REGRAS DE OURO:
    1. Siga os 4 MACRO-BLOCOS: # PERSONA, # TOM DE VOZ, # REGRAS E LIMITAÇÕES, # CONTEXTO E INSTRUÇÕES GERAIS.
    2. Incorpore todas as melhorias sugeridas e decididas na conversa.
    3. O resultado deve ser o PROMPT COMPLETO E FINAL em Português do Brasil.
    """

    user_input = f"""
    PROMPT ATUAL:
    ---
    {request.current_prompt}
    ---
    
    HISTÓRICO DA CONVERSA DE AJUSTE:
    ---
    {chat_summary}
    ---
    
    Com base na conversa acima, gere a nova versão mestre do prompt.
    """

    try:
        client = openai.Client(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_input}
            ],
            temperature=0.5
        )
        return {"prompt": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
