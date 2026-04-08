from openai import AsyncOpenAI
from dotenv import load_dotenv
from config_store import AgentConfig, get_real_model_id, get_model_pricing, format_ai_params
from rag_service import search_knowledge_base
from sqlalchemy.ext.asyncio import AsyncSession
import json
import httpx
import os
import re

load_dotenv()

# Chaves internas do contexto que nunca devem ser expostas no debug/Raio-X
INTERNAL_CTX_KEYS = frozenset(("session_id", "thread_id", "agent_id"))

def get_openai_client(model_name: str = "gpt-4o-mini"):
    if model_name and "gemini" in model_name.lower():
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return AsyncOpenAI(api_key="none", base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
        return AsyncOpenAI(api_key=api_key, base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
    else:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        return AsyncOpenAI(api_key=api_key)

async def summarize_history(history: list) -> dict:
    client = get_openai_client()
    if not client:
        return {"text": "Erro: Chave API.", "usage": None}
    
    messages_text = ""
    for msg in history:
        role = "Usuário" if msg.get("role") == "user" else "Agente"
        content = msg.get("content") or "(Chamada de Ferramenta)"
        messages_text += f"{role}: {content}\n"

    try:
        from config_store import format_ai_params
        kwargs = format_ai_params("gpt-4o-mini", "gpt-4o-mini", {
            "messages": [
                {"role": "system", "content": "Resuma esta conversa em 3 parágrafos."},
                {"role": "user", "content": messages_text}
            ],
            "temperature": 0.5
        })
        response = await client.chat.completions.create(**kwargs)
        return {
            "text": response.choices[0].message.content,
            "usage": response.usage
        }
    except Exception as e:
        return {"text": f"Erro: {str(e)}", "usage": None}

async def extract_questions_from_history(history: list) -> dict:
    client = get_openai_client()
    if not client:
        return {"questions": [], "usage": None}
    
    messages_text = ""
    for msg in history:
        role = "Usuário" if msg.get("role") == "user" else "Agente"
        content = msg.get("content") or ""
        messages_text += f"{role}: {content}\n"

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Liste todas as perguntas feitas pelo USUÁRIO nesta conversa. Retorne apenas as perguntas, uma por linha."},
                {"role": "user", "content": messages_text}
            ],
            temperature=0.3
        )
        text = response.choices[0].message.content
        questions = [q.strip() for q in text.split('\n') if q.strip()]
        return {
            "questions": questions,
            "usage": response.usage
        }
    except Exception as e:
        return {"questions": [f"Erro ao extrair perguntas: {str(e)}"], "usage": None}

async def generate_handoff_summary(history: list) -> str:
    """Gera um resumo estruturado em 4 pontos para transferência entre agentes."""
    client = get_openai_client()
    if not client:
        return "Resumo indisponível (Erro API)."
    
    messages_text = ""
    for msg in history:
        role = "Usuário" if msg.get("role") == "user" else "Agente"
        content = msg.get("content") or "(Ação)"
        messages_text += f"{role}: {content}\n"

    prompt = """
    A conversa abaixo será transferida para outro agente. 
    Gere um resumo EXTREMAMENTE CONCISO em 4 pontos:
    1. Nome do Cliente: (se identificado)
    2. Produto/Serviço:
    3. Problema/Desejo:
    4. Próximo Passo Esperado:

    Retorne apenas os 4 pontos.
    """

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": messages_text}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Erro ao gerar resumo: {str(e)}"

def _resolve_llm_model(config=None) -> str:
    """Retorna o modelo LLM correto baseado na config do roteador. Fallback: gpt-4o-mini."""
    if config is None:
        return "gpt-4o-mini"
    if getattr(config, 'router_enabled', False):
        simple = getattr(config, 'router_simple_model', None)
        if simple:
            return simple
        fallback = getattr(config, 'router_simple_fallback_model', None)
        if fallback:
            return fallback
    return "gpt-4o-mini"


async def get_required_handoff_variables(db_session) -> list:
    """Carrega as variáveis configuradas para coleta no handoff. Retorna lista de dicts {name, description}."""
    if not db_session:
        return []
    try:
        from sqlalchemy import select
        from models import GlobalContextVariableModel
        res = await db_session.execute(
            select(GlobalContextVariableModel)
            .where(GlobalContextVariableModel.key == "support_extracted_variables")
        )
        var_row = res.scalars().first()
        if not var_row or not var_row.value:
            return []
        import json as _json
        raw = var_row.value.strip()
        # Pode ser JSON array de objetos ou string separada por vírgulas
        try:
            parsed = _json.loads(raw)
            if isinstance(parsed, list):
                return [v if isinstance(v, dict) else {"name": str(v), "description": ""} for v in parsed]
        except Exception:
            pass
        # Fallback: string "nome, telefone, email"
        return [{"name": n.strip(), "description": ""} for n in raw.split(",") if n.strip()]
    except Exception as e:
        print(f"⚠️ get_required_handoff_variables error: {e}")
        return []


async def extract_custom_variables(history: list, db_session=None, config=None) -> dict:
    """Extrai variáveis relevantes da conversa usando IA e retorna um dicionário JSON."""
    model = _resolve_llm_model(config)
    client = get_openai_client(model)
    if not client or not history:
        return {}

    vars_to_extract = "nome, telefone, email, pedido, produto, problema, cpf, empresa"

    required_vars = await get_required_handoff_variables(db_session)
    if required_vars:
        import json as _json
        vars_to_extract = _json.dumps(required_vars, ensure_ascii=False)

    messages_text = "\n".join([
        f"{m.get('role', '').upper()}: {m.get('content', '')}"
        for m in history
        if isinstance(m.get('content'), str)
    ])

    prompt = f"""Analise a conversa abaixo e extraia AS SEGUINTES VARIÁVEIS (caso tenham sido indicadas pelo usuário):
Lista de Variáveis a extrair: {vars_to_extract}

Retorne um dicionário JSON simples onde as chaves devem ser EXATAMENTE o nome de cada variável listada (se a lista for um JSON array de objetos, use o valor de "name" como chave) e o valor deve ser o dado extraído da conversa usando a "description" como guia (se houver).
Se não houver dados claros para alguma variável na conversa, simplesmente ignore/não inclua essa chave no resultado.
Retorne APENAS o objeto JSON final com os dados extraídos, sem explicações."""

    try:
        from config_store import format_ai_params
        kwargs = format_ai_params(model, model, {
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": messages_text}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 300
        })
        response = await client.chat.completions.create(**kwargs)
        import json as _json
        raw = response.choices[0].message.content
        return _json.loads(raw) if raw else {}
    except Exception as e:
        print(f"⚠️ extract_custom_variables error: {e}")
        return {}

async def fetch_user_memory(db: AsyncSession, session_id: str) -> str:
    """Recupera fatos conhecidos sobre o usuário da memória estruturada."""
    if not db or not session_id:
        return ""
    
    try:
        from models import UserMemoryModel
        from sqlalchemy import select
        
        result = await db.execute(
            select(UserMemoryModel)
            .where(UserMemoryModel.session_id == session_id)
            .order_by(UserMemoryModel.updated_at.desc())
        )
        memories = result.scalars().all()
        
        if not memories:
            return ""
            
        facts_text = "\n\n# MEM├ôRIA ESTRUTURADA (Fatos conhecidos sobre o usuário):\n"
        for m in memories:
            facts_text += f"- {m.key}: {m.value}\n"
        return facts_text
    except Exception as e:
        print(f"⚠️´©Å Erro ao recuperar memória: {e}")
        return ""

async def update_user_memory(db: AsyncSession, session_id: str, new_message: str, response_text: str):
    """Extrai novos fatos da conversa e atualiza a memória estruturada."""
    if not db or not session_id or not new_message:
        return

    client = get_openai_client()
    if not client:
        return

    extraction_prompt = f"""
    Analise o diálogo abaixo e extraia fatos ESTRUTURADOS e IMPORTANTES sobre o usuário.
    Ignore conversas triviais. Foque em: Nome, Preferências, Profissão, Localização, Dores/Problemas, Objetivos ou Compras realizadas.
    
    DI├üLOGO:
    Usuário: {new_message}
    Agente: {response_text}
    
    Retorne um JSON plano (sem aninhamento) com as chaves sendo o nome do fato e os valores sendo a informação extraída.
    Se não houver nada relevante, retorne um JSON vazio {{}}.
    Exemplo: {{"nome": "João", "hobby": "Astrologia", "dor": "Saturno em Peixes"}}
    """

    try:
        res = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": "Você é um extrator de dados estruturados. Retorne APENAS JSON."},
                      {"role": "user", "content": extraction_prompt}],
            response_format={"type": "json_object"},
            temperature=0
        )
        facts = json.loads(res.choices[0].message.content)
        
        if not facts:
            return

        from models import UserMemoryModel
        from sqlalchemy import select
        
        for key, value in facts.items():
            # Verifica se já existe para atualizar ou criar
            stmt = select(UserMemoryModel).where(UserMemoryModel.session_id == session_id, UserMemoryModel.key == key)
            existing_res = await db.execute(stmt)
            existing = existing_res.scalars().first()
            
            if existing:
                existing.value = str(value)
                existing.source_message = new_message
            else:
                new_fact = UserMemoryModel(
                    session_id=session_id,
                    key=key,
                    value=str(value),
                    source_message=new_message
                )
                db.add(new_fact)
        
        await db.commit()
    except Exception as e:
        print(f"⚠️´©Å Erro ao atualizar memória: {e}")

def verify_output_safety(text: str, config: AgentConfig) -> str:
    if not text: return text
    
    # 1. Blacklist Hard Filter (Regex)
    blacklist = getattr(config, 'security_competitor_blacklist', None)
    if blacklist:
        # Create a combined regex for all items in the blacklist (comma separated)
        items = [i.strip() for i in blacklist.split(',') if i.strip()]
        if items:
            pattern = re.compile(r'\b(' + '|'.join(map(re.escape, items)) + r')\b', re.IGNORECASE)
            text = pattern.sub("[CONCORRENTE BLOQUEADO]", text)

    # 2. Forbidden Topics Hard Filter (Regex)
    forbidden = getattr(config, 'security_forbidden_topics', None)
    if forbidden:
        items = [i.strip() for i in forbidden.split(',') if i.strip()]
        if items:
            pattern = re.compile(r'\b(' + '|'.join(map(re.escape, items)) + r')\b', re.IGNORECASE)
            text = pattern.sub("[TOPICO BLOQUEADO]", text)

    # 3. PII Filter (Regex for Email and CPF)
    if getattr(config, 'security_pii_filter', False):
        # Email pattern
        text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', "[EMAIL OCULTO]", text)
        # CPF pattern (simplified)
        text = re.sub(r'\d{3}\.\d{3}\.\d{3}-\d{2}', "[CPF OCULTO]", text)
        # Phone numbers (Brazil format)
        text = re.sub(r'\(?\d{2}\)?\s?\d{4,5}-\d{4}', "[TELEFONE OCULTO]", text)

    return text

async def validate_response_ai(text: str, config: AgentConfig) -> dict:
    """Uses a fast model to audit the response against security protocols."""
    client = get_openai_client()
    if not client or not text:
        return {"is_safe": True, "reason": None}

    # Extract security instructions from config to give to the validator
    protocols = []
    if getattr(config, 'security_competitor_blacklist', None): protocols.append(f"- Proibido citar: {config.security_competitor_blacklist}")
    if getattr(config, 'security_forbidden_topics', None): protocols.append(f"- Proibido falar de: {config.security_forbidden_topics}")
    if getattr(config, 'security_discount_policy', None): protocols.append(f"- Política de Descontos: {config.security_discount_policy}")
    
    if not protocols:
        return {"is_safe": True, "reason": None}

    prompt = f"""
    Sua missão é ser um AUDITOR DE SEGURAN├çA E CONDUTA para um agente de IA.
    
    PROTOCOLO DE SEGURAN├çA:
    {chr(10).join(protocols)}
    
    RESPOSTA A SER AUDITADA:
    "{text}"
    
    REGRAS DE AUDITORIA:
    1. Se a resposta VIOLA algum protocolo acima, responda apenas: "VIOLATION: [motivo curto]".
    2. Se a resposta é SEGURA e segue todos os protocolos, responda apenas: "SAFE".
    
    Seja rigoroso.
    """

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": prompt}],
            temperature=0.0,
            max_tokens=50
        )
        audit_result = response.choices[0].message.content.strip()
        
        if audit_result.startswith("VIOLATION"):
            return {"is_safe": False, "reason": audit_result.replace("VIOLATION:", "").strip()}
        return {"is_safe": True, "reason": None}
    except Exception as e:
        print(f"⚠️´©Å Erro Auditoria IA: {e}")
        return {"is_safe": True, "reason": None} # Em caso de erro na auditoria, libera por segurança (ou bloqueia dependendo da política)

async def classify_message_complexity(message: str, config: AgentConfig, history: list = None) -> str:
    """Classifies the message as SIMPLE or COMPLEX using a fast model."""
    client = get_openai_client()
    if not client:
        return "COMPLEX"
    
    last_agent_msg = ""
    if history:
        for m in reversed(history):
            if m.get("role") == "assistant":
                last_agent_msg = m.get("content", "")
                break
        
    prompt = f"""
    Classifique a mensagem do usuário como 'SIMPLE' ou 'COMPLEX' para fins de roteamento de custo.
    
    CRIT├ëRIOS PARA 'SIMPLE':
    - Saudaç├Áes simples (Oi, Olá, Bom dia).
    - Agradecimentos (Obrigado, Valeu, OK).
    - Mensagens de encerramento.
    - Perguntas triviais que não exigem consulta de dados ou aç├Áes.
    
    CRIT├ëRIOS PARA 'COMPLEX':
    - Respostas a perguntas feitas pelo agente (mesmo que curtas).
    - Dúvidas sobre produtos, preços ou regras.
    - Solicitaç├Áes que exigem uso de ferramentas (webhooks).
    - Perguntas que exigem busca na base de conhecimento (RAG).
    - Situaç├Áes de suporte ou reclamaç├Áes.
    
    Responda APENAS com a palavra: SIMPLE ou COMPLEX.

    {"ÚLTIMA FALA DO AGENTE: " + last_agent_msg if last_agent_msg else ""}
    MENSAGEM DO USUÁRIO: "{message}"
    """
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": prompt}],
            temperature=0.0,
            max_tokens=10
        )
        result = response.choices[0].message.content.strip().upper()
        return "SIMPLE" if "SIMPLE" in result else "COMPLEX"
    except Exception as e:
        print(f"⚠️´©Å Erro Classificação de Custo: {e}")
        return "COMPLEX"

def resolve_conditional_blocks(text: str, context_variables: dict) -> str:
    """Processa blocos [IF:variavel]...[/IF] no prompt do agente.
    Valores verdadeiros: 'true', '1', 'sim', 'yes' (case-insensitive).
    Use [IF:variavel:false] para bloco que aparece quando a variável é falsa/ausente.
    """
    def evaluate_block(match):
        condition = match.group(1)
        content = match.group(2)
        parts = condition.split(":", 1)
        var_name = parts[0].strip().lower()
        expect_false = len(parts) > 1 and parts[1].strip().lower() == "false"
        
        # Busca insensível a maiúsculas no dicionário de variáveis
        val = None
        if context_variables:
            for k, v in context_variables.items():
                if k.lower() == var_name:
                    val = v
                    break
        
        raw_value = str(val or "").strip().lower()
        is_truthy = raw_value in ("true", "1", "sim", "yes")
        
        if expect_false:
            return content if not is_truthy else ""
        return content if is_truthy else ""

    return re.sub(r'\[IF:([^\]]+)\](.*?)\[/IF\]', evaluate_block, text, flags=re.DOTALL | re.IGNORECASE)


async def process_message(
    message: str, 
    history: list, 
    config: AgentConfig, 
    tools: list = None, 
    context_variables: dict = None,
    db: AsyncSession = None,
    performed_tool_calls: list = None
):
    active_role = "main"
    # --- COST ROUTER (Complexity Classification) ---
    if getattr(config, 'router_enabled', False):
        complexity = await classify_message_complexity(message, config, history)
        if complexity == "SIMPLE":
            active_role = "router_simple"
            config.model = config.router_simple_model
            if getattr(config, 'router_simple_fallback_model', None):
                config.fallback_model = config.router_simple_fallback_model
            print(f"🚀 Cost Router: SIMPLE message detected. Using {config.router_simple_model} (Role: router_simple)")
        else:
            active_role = "router_complex"
            config.model = config.router_complex_model
            if getattr(config, 'router_complex_fallback_model', None):
                config.fallback_model = config.router_complex_fallback_model
            print(f"🚀 Cost Router: COMPLEX message detected. Using {config.router_complex_model} (Role: router_complex)")

    # Track tool calls for Raio-X (outside the loop to accumulate)
    if performed_tool_calls is None:
        performed_tool_calls = []

    # --- ROLE-SPECIFIC CONTEXT WINDOW ---
    settings = getattr(config, 'model_settings', {})
    if isinstance(settings, str): 
        try: settings = json.loads(settings)
        except: settings = {}
    
    role_config = settings.get(active_role, {}) if settings else {}
    target_window = role_config.get("context_window", config.context_window)
    
    # history is a list of {"role": ..., "content": ...}
    # Each 'round' is usually 2 messages.
    if history and len(history) > (target_window * 2):
        history = history[-(target_window * 2):]
        print(f"✂️´©Å Context Window: Truncated history to {target_window} rounds for role {active_role}")


    client = get_openai_client(config.model)
    if not client:
        return {"content": "Erro: API Key não configurada para o modelo principal.", "usage": None, "error": True, "debug": {"error": "API Key missing"}}

    messages = [{"role": "system", "content": config.system_prompt}]
    
    # Ensure context_variables is a dict
    context_variables = context_variables or {}

    # --- GLOBAL & CONTEXT VARIABLE SUBSTITUTION ---
    if context_variables:
        messages[0]["content"] = resolve_conditional_blocks(messages[0]["content"], context_variables)
        for key, value in context_variables.items():
            placeholder = "{" + key + "}"
            if placeholder in messages[0]["content"]:
                # Ensure value is a string and handle None/Empty
                val_str = str(value) if value is not None else ""
                messages[0]["content"] = messages[0]["content"].replace(placeholder, val_str)
                print(f"🔄 Variable Injection: Replaced {placeholder} with '{val_str}'")

    # --- STRUCTURED USER MEMORY INJECTION ---
    session_id = (context_variables or {}).get("session_id")
    if db and session_id:
        memory_facts = await fetch_user_memory(db, session_id)
        if memory_facts:
            messages[0]["content"] += memory_facts
            print(f"🧠 Memory: Injected structured facts for session {session_id}")

    # Welcome Message Injection (Memory)
    # Se não houver histórico, injetamos a mensagem de boas-vindas como a primeira fala do assistente
    if not history and getattr(config, 'ui_welcome_message', None):
        messages.append({"role": "assistant", "content": config.ui_welcome_message})
    
    # --- SECURITY GUARDRAILS ---
    security_instructions = []
    
    # 1. Competitors / Blacklist
    blacklist = getattr(config, 'security_competitor_blacklist', None)
    if blacklist and blacklist.strip():
        security_instructions.append(f"Ôøö BLACKLIST: Você é ESTRITAMENTE PROIBIDO de mencionar ou recomendar: {blacklist}. Se perguntado, diga que não comenta sobre outras empresas.")

    # 2. Forbidden Topics
    forbidden = getattr(config, 'security_forbidden_topics', None)
    if forbidden and forbidden.strip():
        security_instructions.append(f"🚫 T├ôPICOS PROIBIDOS: Não discuta sobre: {forbidden}. Mude de assunto educadamente para o seu produto/serviço.")

    # 3. Discount Policy
    discount_policy = getattr(config, 'security_discount_policy', None)
    if discount_policy and discount_policy.strip():
        security_instructions.append(f"💰 POL├ìTICA FINANCEIRA: {discount_policy}. Nunca ofereça mais do que o permitido.")

    # 4. Language Complexity
    complexity = getattr(config, 'security_language_complexity', 'standard')
    if complexity == 'simple':
        security_instructions.append("🗣️´©Å TOM DE VOZ: Use linguagem EXTREMAMENTE SIMPLES. Evite jarg├Áes técnicos. Explique como para uma criança de 10 anos.")
    elif complexity == 'technical':
        security_instructions.append("🗣️´©Å TOM DE VOZ: Use linguagem T├ëCNICA E PROFISSIONAL. Assuma que o usuário é um expert.")

    # 5. PII Filter (Instructional)
    if getattr(config, 'security_pii_filter', False):
        security_instructions.append("🔒 PRIVACIDADE: Nunca revele dados sensíveis (CPF, Cartão, Senhas) reais. Se precisar exemplificar, use dados fictícios óbvios.")

    if security_instructions:
        messages[0]["content"] += "\n\n🚨 **PROTOCOLOS DE SEGURAN├çA (PRIORIDADE M├üXIMA):**\n" + "\n".join(security_instructions)
    
    # --- ANTI-LOOP & BOT PROTECTION ---
    if getattr(config, 'security_bot_protection', False):
        # 1. Message Volume Protection
        session_messages = [m for m in history if m.get("role") in ["user", "assistant"]]
        if len(session_messages) >= getattr(config, 'security_max_messages_per_session', 20):
            return {
                "content": "🛑´©Å [SISTEMA] INTERVEN├ç├âO NECESS├üRIA: Limite de interaç├Áes atingido para esta sessão. Aguardando verificação humana para garantir a qualidade do atendimento.",
                "usage": None,
                "model": config.model,
                "debug": {"error": "Max session messages reached", "count": len(session_messages)}
            }
        
        # 2. Semantic Loop Detection (Simple similarity)
        def get_similarity(s1, s2):
            s1, s2 = s1.lower(), s2.lower()
            words1, words2 = set(s1.split()), set(s2.split())
            if not words1 or not words2: return 0
            intersection = words1.intersection(words2)
            return len(intersection) / max(len(words1), len(words2))

        threshold = getattr(config, 'security_semantic_threshold', 0.85)
        loop_window = getattr(config, 'security_loop_count', 3)
        # Check if user is repeating themselves
        user_history = [m["content"] for m in history if m.get("role") == "user"]
        for old_msg in user_history[-loop_window:]: # Check dynamic window
            if get_similarity(message, old_msg) > threshold:
                return {
                    "content": "⚠️ [SISTEMA] LOOP DETECTADO: Identificamos redundância no diálogo. Para sua segurança e economia de tokens, o atendimento foi pausado. Um humano analisará esta conversa em breve.",
                    "usage": None,
                    "model": config.model,
                    "debug": {"error": "Semantic loop detected", "similarity": get_similarity(message, old_msg)}
                }

    # --- RAG BYPASS (SHORT CIRCUIT) ---
    # Skip RAG for simple greeting or date calculation type messages to improve speed/accuracy
    skip_rag = False
    skip_reason = None
    
    # 1. Check if routed as SIMPLE
    if getattr(config, 'router_enabled', False):
        # Local complexity check for fast skip
        is_simple = len(message.split()) < 4 or any(x in message.lower() for x in ["oi", "ola", "bom dia", "boa tarde", "obrigado", "valeu"])
        if is_simple:
            skip_rag = True
            skip_reason = "Mensagem simples ou saudação (RAG Otimizado)"
            print("⚠️ RAG Bypass: Message identified as simple/greeting.")

    # 2. Check if it's a date calculation (usually doesn't need knowledge base)
    if not skip_rag and any(x in message.lower() for x in ["data", "quinta", "sexta", "semana", "mes", "dia", "amanh"]) and len(message) < 50:
        skip_rag = True
        skip_reason = "Consulta temporal (RAG Ignorado)"
        print("⚠️ RAG Bypass: Date-related short query detected.")

    # 1. RAG INJECTION (Hybrid Search)
    rag_context = ""
    relevant_items = []
    rag_usage = None
    mini_prompt_tokens = 0
    mini_completion_tokens = 0
    main_prompt_tokens = 0
    main_completion_tokens = 0
    
    # New Multi-KB Logic
    kb_ids = getattr(config, 'knowledge_base_ids', [])
    # Legacy Fallback
    if not kb_ids and getattr(config, 'knowledge_base_id', None):
        kb_ids = [config.knowledge_base_id]
        
    if db and kb_ids and not skip_rag:
        limit = getattr(config, 'rag_retrieval_count', 5)
        
        # Use Simple routing models for background tasks if enabled
        rag_model = "gpt-4o-mini"
        rag_fallback = None
        if getattr(config, 'router_enabled', False):
            rag_model = config.router_simple_model
            rag_fallback = getattr(config, 'router_simple_fallback_model', None)

        relevant_items, rag_usage = await search_knowledge_base(
            db=db,
            query=message,
            kb_ids=kb_ids,
            limit=limit,
            model=rag_model,
            fallback_model=rag_fallback
        )
        
        # Aggregate RAG usage into total
        if rag_usage:
            # RAG always uses a mini model by default or router_simple_model
            mini_prompt_tokens += rag_usage.prompt_tokens
            mini_completion_tokens += rag_usage.completion_tokens
            print(f"💰 RAG Cost ({rag_usage.model}): {rag_usage.prompt_tokens} prompt, {rag_usage.completion_tokens} completion tokens.")
        
        if relevant_items:
            rag_context = "\n\n# CONTEXTO RECUPERADO (RAG):\nPriorize as informaç├Áes abaixo para responder. Se a informação necessária não estiver no contexto abaixo, verifique se ela consta nas suas instruç├Áes principais (System Prompt) ou base de conhecimento geral.\n"
            for item in relevant_items:
                page_info = f" (Pág {item['metadata'].get('page')})" if item.get('metadata') and item['metadata'].get('page') else ""
                meta_info = f"Metadado: {item['metadata_val']}\n" if item.get('metadata_val') else ""
                rag_context += f"---\n{meta_info}Perg: {item['question']}\nResp{page_info}: {item['answer']}\n"
            
            print(f"🔍 RAG: Injected {len(relevant_items)} items into context (Limit: {limit}).")
            if getattr(config, 'inbox_capture_enabled', True):
                rag_context += " Caso a informação necessária para responder a uma PERGUNTA DIRETA do usuário não esteja presente nos contextos, use a ferramenta `registrar_duvida_sem_resposta`."


    # 2. DATE AWARENESS
    if getattr(config, 'date_awareness', False):
        try:
            from datetime import datetime, timedelta, timezone
            dias_semana = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
            brasilia_tz = timezone(timedelta(hours=-3))
            now = datetime.now(brasilia_tz)
            
            if getattr(config, 'simulated_time', None):
                try:
                    sim_h, sim_m = map(int, config.simulated_time.split(':'))
                    now = now.replace(hour=sim_h, minute=sim_m)
                except: pass

            date_context = "\n\n# CONTEXTO TEMPORAL:\n"
            for i in range(7):
                target_date = now + timedelta(days=i)
                dia_str = dias_semana[target_date.weekday()]
                date_fmt = target_date.strftime("%d/%m/%y")
                
                if i == 0:
                    line = f"- Hoje é {dia_str}, {date_fmt} - {now.strftime('%H:%M')}"
                elif i == 1:
                    line = f"- Amanhã será {dia_str}, {date_fmt}"
                else:
                    line = f"- {dia_str.capitalize()} será {date_fmt}"
                date_context += line + "\n"
            
            messages[0]["content"] += date_context
        except Exception as e:
            print(f"⚠️´©Å Erro data: {e}")

    # FIX: Actually inject RAG context if available
    if rag_context:
        messages[0]["content"] += rag_context
    elif db and kb_ids and not skip_rag and not relevant_items:
        # RAG was consulted but found nothing - explicitly tell the model to use System Prompt
        messages[0]["content"] += "\n\n# NOTA IMPORTANTE: A base de conhecimento (RAG) foi consultada para esta pergunta mas N├âO retornou resultados. Você DEVE responder APENAS usando as informaç├Áes que já estão nas suas instruç├Áes acima."
        if getattr(config, 'inbox_capture_enabled', True):
            messages[0]["content"] += " Se a resposta para uma PERGUNTA DIRETA do usuário não estiver la, USE A FERRAMENTA 'registrar_duvida_sem_resposta'. (⚠️´©Å ATEN├ç├âO: S├ô use a ferramenta se o usuário estiver perguntando algo que você não sabe. Se ele estiver apenas conversando ou respondendo a você, N├âO chame a ferramenta)."

    messages.extend(history)
    messages.append({"role": "user", "content": message})

    # Convert ToolModel list to OpenAI Tool format
    openai_tools = None
    if tools:
        openai_tools = []
        for tool in tools:
            try:
                full_params = json.loads(tool.parameters_schema)
                bindings = full_params.get("_bindings", {})
                ai_properties = {}
                required_params = full_params.get("required", [])
                visible_required = []

                for pname, pdef in full_params.get("properties", {}).items():
                    if pname in bindings: continue
                    ai_properties[pname] = pdef
                    if pname in required_params: visible_required.append(pname)
                
                ai_params = {"type": "object", "properties": ai_properties, "required": visible_required}
                openai_tools.append({
                    "type": "function",
                    "function": {"name": tool.name, "description": tool.description, "parameters": ai_params}
                })
            except Exception as e:
                print(f"Erro tool {tool.name}: {e}")

    # 3. NATIVE HANDOFF TOOL
    # Adicionamos a ferramenta de transferência se o agente tiver a permissão habilitada
    openai_tools = openai_tools or []
    existing_tool_names = [t["function"]["name"] for t in openai_tools]
    
    has_support_tool = any(any(k in t_name for k in ["suporte", "atendente", "humano", "transbordo"]) for t_name in existing_tool_names)
    if has_support_tool or getattr(config, 'handoff_enabled', False):
        # Inject pre-collection instruction if there are required variables
        try:
            required_vars = await get_required_handoff_variables(db)
            if required_vars:
                var_lines = "\n".join([
                    f"  - **{v['name']}**" + (f": {v['description']}" if v.get('description') else "")
                    for v in required_vars
                ])
                messages[0]["content"] += (
                    f"\n\n📋 **PROTOCOLO DE COLETA PRÉ-TRANSBORDO (OBRIGATÓRIO):**\n"
                    f"Antes de acionar qualquer ferramenta de transferência ou suporte humano, você DEVE confirmar que as seguintes informações foram fornecidas pelo usuário nesta conversa:\n"
                    f"{var_lines}\n"
                    f"Se alguma dessas informações ainda não foi mencionada, PERGUNTE ao usuário de forma natural e amigável antes de transferir. "
                    f"Só acione a ferramenta de transbordo após ter todas as informações (ou se o usuário explicitamente recusar fornecer alguma após 2 tentativas)."
                )
        except Exception as e:
            print(f"⚠️ Erro ao injetar protocolo de coleta: {e}")

    if has_support_tool:
        messages[0]["content"] += "\n\n🚨 PROTOCOLO DE SUPORTE: Se o usuário pedir para falar com um atendente/humano ou solicitar suporte, VÁ DIRETO AO PONTO E ACIONE A FERRAMENTA DE SUPORTE IMEDIATAMENTE. É ESTRITAMENTE PROÍBIDO perguntar coisas como: 'Posso chamar o suporte?', 'Quer que eu transfira agora?', 'Vou te colocar com o atendente, ok?'. Você deve apenas chamar a ferramenta e CONFIRMAR FIRMEMENTE o sucesso ('O time de suporte já foi acionado e um humano te atenderá em breve.')."

    if getattr(config, 'handoff_enabled', False) and "transferir_atendimento" not in existing_tool_names:
        agent_list_str = "humano (Suporte humano no Chatwoot)"
        try:
            if db:
                from sqlalchemy import select
                from models import AgentConfigModel
                # Filtramos agentes ATIVOS e que também permitem HANDOFF (criando um grupo de swarm)
                res = await db.execute(
                    select(AgentConfigModel.id, AgentConfigModel.name, AgentConfigModel.description)
                    .where(AgentConfigModel.is_active == True)
                    .where(AgentConfigModel.handoff_enabled == True)
                    .where(AgentConfigModel.id != config.id) # Não transferir para si mesmo
                )
                agents_found = res.all()
                if agents_found:
                    agent_list_str = ", ".join([
                        f"{a.name} (ID: {a.id}) - Descrição: {a.description or 'Sem descrição'}" 
                        for a in agents_found
                    ]) + ", humano (Chatwoot)"
        except Exception as e:
            print(f"⚠️´©Å Erro ao listar agentes para handoff: {e}")

        openai_tools.append({
            "type": "function",
            "function": {
                "name": "transferir_atendimento",
                "description": f"Transfere o atendimento para outro colega especialista. AGENTES DISPON├ìVEIS: {agent_list_str}.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "destino": {
                            "type": "string",
                            "description": "ID ou Nome do agente (escolha baseado na descrição se ele é o especialista correto)"
                        },
                        "motivo": {
                            "type": "string",
                            "description": "Explique brevemente por que este colega é melhor para continuar este papo"
                        }
                    },
                    "required": ["destino", "motivo"]
                }
            }
        })

    # 4. INTERNAL DATE CALCULATOR (LLM-based reasoning for complex dates)
    if getattr(config, 'date_awareness', False) and "internal_date_calculator" not in existing_tool_names:
        openai_tools.append({
            "type": "function",
            "function": {
                "name": "internal_date_calculator",
                "description": "Calcula datas precisas baseado em calendários e termos relativos (ex: 'próxima sexta', 'daqui a 3 meses', 'dia útil'). Use sempre que o usuário perguntar por uma data específica no futuro ou passado.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date_description": {
                            "type": "string",
                            "description": "Descrição da data que o usuário quer saber (ex: 'próxima sexta-feira')"
                        }
                    },
                    "required": ["date_description"]
                }
            }
        })

    # 5. INTERNAL UNANSWERED QUESTIONS TOOL
    if getattr(config, 'inbox_capture_enabled', True) and "registrar_duvida_sem_resposta" not in existing_tool_names:
        messages[0]["content"] += "\n\n🚨 PROTOCOLO DE D├ÜVIDAS DESCONHECIDAS: Se o usuário te fizer uma **PERGUNTA DIRETA** sobre algo que VOC├è N├âO SABE (não está nas suas instruç├Áes nem via RAG), N├âO responda em texto que não sabe. OBRIGATORIAMENTE chame a ferramenta 'registrar_duvida_sem_resposta' com a pergunta dele. ⚠️´©Å IMPORTANTE: S├ô CHAME SE FOR UMA PERGUNTA! Se o usuário estiver apenas conversando, fazendo uma afirmação, ou respondendo algo que VOC├è perguntou, N├âO chame a ferramenta, apenas converse normalmente."
        openai_tools.append({
            "type": "function",
            "function": {
                "name": "registrar_duvida_sem_resposta",
                "description": "CHAME APENAS SE: O usuário fez uma PERGUNTA NOVA que você N├âO SABE a resposta. N├âO CHAME SE: For apenas bate-papo, uma afirmação do usuário, ou se o usuário estiver respondendo uma pergunta sua.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "pergunta": {
                            "type": "string",
                            "description": "A pergunta exata do usuário que você não soube responder."
                        }
                    },
                    "required": ["pergunta"]
                }
            }
        })




    class UsageLog:
        def __init__(self, mp, mc, xp, xc):
            self.mini_prompt = mp
            self.mini_completion = mc
            self.main_prompt = xp
            self.main_completion = xc
            # Backward compatibility for code expecting prompt_tokens/completion_tokens
            self.prompt_tokens = mp + xp
            self.completion_tokens = mc + xc

    try:
        from config_store import MODEL_INFO
        iteration = 0
        from config_store import MODEL_INFO
        while iteration < 5:
            iteration += 1
            print(f"­ƒñû Turno {iteration}...")
            
            # ASYNC CALL WITH FALLBACK LOGIC
            response = None
            last_error = None
            
            # Hierarquia de modelos para a resposta final com seus respectivos papéis
            models_to_try = [
                {"name": config.model, "role": active_role},
                {"name": getattr(config, 'fallback_model', None), "role": "fallback" if active_role == "main" else f"{active_role}_fallback"},
                {"name": "gpt-4o-mini", "role": "emergency"}
            ]
            
            errors_in_loop = []
            for trial in models_to_try:
                current_model = trial["name"]
                trial_role = trial["role"]
                if not current_model: continue
                
                # Get role settings
                all_settings = getattr(config, 'model_settings', {})
                if isinstance(all_settings, str): 
                    try: all_settings = json.loads(all_settings)
                    except: all_settings = {}
                
                role_config = all_settings.get(trial_role, {}) if all_settings else {}
                
                # Params: role -> global -> default
                temp = role_config.get("temperature", config.temperature)
                top_p = role_config.get("top_p", config.top_p)
                top_k = role_config.get("top_k", getattr(config, 'top_k', 40))
                p_pen = role_config.get("presence_penalty", getattr(config, 'presence_penalty', 0.0))
                f_pen = role_config.get("frequency_penalty", getattr(config, 'frequency_penalty', 0.0))

                current_client = get_openai_client(current_model)
                if not current_client:
                    continue
                
                try:
                    # === SELEÇÃO DO MODELO (Resolve família → ID real via API) ===
                    api_model_name = get_real_model_id(current_model)
                    
                    # PREPARA PARÂMETROS BASE
                    base_params = {
                        "messages": messages,
                        "temperature": temp,
                        "top_p": top_p if top_p is not None else 1.0,
                        "presence_penalty": p_pen,
                        "frequency_penalty": f_pen
                    }
                    
                    if openai_tools:
                        base_params["tools"] = openai_tools
                        base_params["tool_choice"] = "auto"

                    # FORMATA DINAMICAMENTE (Fix para GPT-5 / O1)
                    kwargs = format_ai_params(api_model_name, current_model, base_params)

                    response = await current_client.chat.completions.create(**kwargs)
                    print(f"✅ Resposta gerada (Role: {trial_role}, Modelo: {api_model_name} as {current_model})")
                    break
                except Exception as e:
                    print(f"⚠️´©Å Erro no modelo {current_model} como {api_model_name} ({trial_role}): {e}")
                    last_error = e
                    errors_in_loop.append(f"{current_model}: {str(e)}")
                    continue
            
            if not response:
                raise Exception("\n".join(errors_in_loop))


            message_content = response.choices[0].message
            finish_reason = response.choices[0].finish_reason
            print(f"­ƒÅü Finalizado (Motivo: {finish_reason})")
            
            if response.usage:
                # Decide if these tokens go to mini or main based on the model name
                is_mini = any(x in current_model.lower() for x in ["mini", "flash", "nano", "gpt-3.5"])
                if is_mini:
                    mini_prompt_tokens += response.usage.prompt_tokens
                    mini_completion_tokens += response.usage.completion_tokens
                else:
                    main_prompt_tokens += response.usage.prompt_tokens
                    main_completion_tokens += response.usage.completion_tokens

            tool_calls = message_content.tool_calls
            
            if not tool_calls:

                # Final Safety Check before returning
                safe_content = verify_output_safety(message_content.content, config)
                is_violation = safe_content != message_content.content
                
                # --- DOUBLE-CHECK SECURITY (Validator IA) ---
                audit_log = None
                if getattr(config, 'security_validator_ia', False) and not is_violation:
                    audit = await validate_response_ai(safe_content, config)
                    if not audit["is_safe"]:
                        is_violation = True
                        audit_log = audit["reason"]
                        safe_content = "🛑´©Å [SISTEMA] Desculpe, não posso prosseguir com essa resposta seguindo nossas políticas internas de conduta e segurança. Como posso te ajudar com outro assunto?"

                # Fallback em caso de resposta vazia sem ferramentas (bloqueio de segurança da Google costuma fazer isso)
                if not safe_content or not safe_content.strip():
                    if finish_reason == "safety":
                        safe_content = "🛑´©Å Desculpe, não posso responder a isso por diretrizes de segurança da IA."
                    else:
                        # RETRY WITHOUT TOOLS: Tools may be confusing the model (especially Gemini)
                        print(f"⚠️´©Å Resposta Vazia detectada. Tentando retry SEM ferramentas...")
                        try:
                            retry_client = get_openai_client(current_model)
                            if retry_client:
                                retry_kwargs = {
                                    "model": api_model_name,
                                    "messages": messages,
                                    "temperature": temp if 'temp' in dir() else config.temperature,
                                }
                                retry_response = await retry_client.chat.completions.create(**retry_kwargs)
                                retry_content = retry_response.choices[0].message.content
                                if retry_content and retry_content.strip():
                                    safe_content = verify_output_safety(retry_content, config)
                                    print(f"✅ Retry sem ferramentas funcionou! Resposta gerada.")
                                    # Update usage
                                    if retry_response.usage:
                                        is_mini_r = any(x in current_model.lower() for x in ["mini", "flash", "nano", "gpt-3.5"])
                                        if is_mini_r:
                                            mini_prompt_tokens += retry_response.usage.prompt_tokens
                                            mini_completion_tokens += retry_response.usage.completion_tokens
                                        else:
                                            main_prompt_tokens += retry_response.usage.prompt_tokens
                                            main_completion_tokens += retry_response.usage.completion_tokens
                        except Exception as retry_err:
                            print(f"⚠️´©Å Retry sem ferramentas também falhou: {retry_err}")
                        
                        # If still empty after retry
                        if not safe_content or not safe_content.strip():
                            safe_content = "Não consegui gerar uma resposta satisfatória para sua solicitação. Por favor, tente reformular sua pergunta."
                    print(f"⚠️´©Å Resposta final após fallback: {safe_content[:100]}...")

                return {
                    "content": safe_content,
                    "usage": UsageLog(mini_prompt_tokens, mini_completion_tokens, main_prompt_tokens, main_completion_tokens),
                    "model": f"{current_model} ({api_model_name})" if current_model != api_model_name else current_model,
                    "model_role": trial_role,
                    "violations": is_violation,
                    "error": False,
                    "debug": {
                        "tool_calls": performed_tool_calls,
                        "full_prompt": [m if isinstance(m, dict) else m.model_dump() for m in messages],
                        "finish_reason": finish_reason,
                        "rag_context": rag_context,
                        "rag_items": relevant_items,
                        "rag_skipped": skip_rag,
                        "rag_skip_reason": skip_reason,
                        "guardrails_active": len(security_instructions) > 0,
                        "violations": is_violation,
                        "audit_log": audit_log,
                        "errors_in_loop": errors_in_loop,
                        "context_variables": {k: v for k, v in context_variables.items() if k not in INTERNAL_CTX_KEYS} if context_variables else {}
                    }
                }

            if tool_calls:
                print(f"­ƒñû Chamando {len(tool_calls)} ferramentas.")
                messages.append(message_content)

                for tc in tool_calls:
                    func_name = tc.function.name
                    func_args_str = tc.function.arguments
                    target_tool = next((t for t in tools if t.name == func_name), None) if tools else None
                    tool_output = "Erro: Ferramenta não encontrada."
                    
                    if target_tool and target_tool.webhook_url:
                        try:
                            final_args = json.loads(func_args_str)
                            try:
                                # Bindings injection logic
                                tool_schema = json.loads(target_tool.parameters_schema)
                                bindings = tool_schema.get("_bindings", {})
                                
                                # Base var_map with system variables
                                var_map = {
                                    "{{contact.phone}}": context_variables.get("contact_phone"),
                                    "{{contact.name}}": context_variables.get("contact_name"),
                                    "{{conversation.id}}": context_variables.get("thread_id") or context_variables.get("session_id"),
                                    "{{memory.id}}": f"{context_variables.get('contact_phone', 'no_phone')}_{context_variables.get('thread_id', 'no_thread')}",
                                    "{{current_date}}": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                }
                                
                                # Dynamically add all context variables (including globals) as {{key}}
                                if context_variables:
                                    for k, v in context_variables.items():
                                        var_map[f"{{{{{k}}}}}"] = v 
                                
                                for pname, bkey in bindings.items():
                                    if bkey in var_map: final_args[pname] = var_map[bkey]
                            except: pass
                            
                            print(f"     ­ƒÜÇ Webhook: {target_tool.webhook_url}")
                            async with httpx.AsyncClient() as http_client:
                                webhook_response = await http_client.post(target_tool.webhook_url, json=final_args, timeout=30.0)
                                webhook_response.raise_for_status()
                                tool_output = webhook_response.text
                            
                            try:
                                data = json.loads(tool_output)
                                if isinstance(data, dict):
                                    msg = data.get("resposta") or data.get("message") or data.get("text")
                                    if msg: tool_output = f"MENSAGEM DA FERRAMENTA: {msg}\n(Dados Brutos: {tool_output})"
                            except: pass
                        except Exception as e:
                            tool_output = f"Erro: {str(e)}"

                    # --- INTERNAL DATE CALCULATOR HANDLER ---
                    elif func_name == "internal_date_calculator":
                        try:
                            func_args = json.loads(func_args_str)
                            desc = func_args.get("date_description")
                            
                            # Use a smaller/cheaper model for this specific task as requested
                            mini_client = get_openai_client()
                            from datetime import datetime
                            now_str = datetime.now().strftime("%Y-%m-%d (%A)")
                            
                            mini_response = await mini_client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[
                                    {"role": "system", "content": f"Você é um especialista em cálculos de datas. Hoje é {now_str}. Sua tarefa é calcular a data exata solicitada pelo usuário e retornar NO FORMATO: 'YYYY-MM-DD (Dia da Semana)'. Seja curto e direto."},
                                    {"role": "user", "content": f"Qual a data de: {desc}?"}
                                ],
                                temperature=0.0
                            )
                            tool_output = mini_response.choices[0].message.content
                            print(f"     📅 Date Calc Result: {tool_output}")
                        except Exception as e:
                            tool_output = f"Erro ao calcular data: {str(e)}"

                    # --- INTERNAL UNANSWERED QUESTIONS HANDLER ---
                    elif func_name == "registrar_duvida_sem_resposta":
                        try:
                            from models import UnansweredQuestionModel
                            func_args = json.loads(func_args_str)
                            question = func_args.get("pergunta")
                            
                            # Safely extract session_id from context_variables (which was passed, but we didn't have session_id local variable)
                            current_session_id = context_variables.get("session_id") if context_variables else "Desconhecida"
                            if not current_session_id and context_variables.get("thread_id"):
                                current_session_id = context_variables.get("thread_id")
                                
                            context_text = f"Sessão: {current_session_id}\nMensagens recentes extraídas:\n" + "\n".join([f"{m.get('role', 'N/A')}: {m.get('content', 'N/A')}" for m in history[-5:]])
                            
                            
                            # ID do agente para o Inbox
                            ag_id = getattr(config, 'id', None)
                            if not ag_id and context_variables:
                                ag_id = context_variables.get("agent_id")

                            new_q = UnansweredQuestionModel(
                                agent_id=ag_id,
                                session_id=current_session_id,
                                question=question,
                                context=context_text,
                                status="PENDENTE"
                            )
                            if db:
                                db.add(new_q)
                                await db.commit()
                                tool_output = "Desculpe, eu ainda não tenho essa informação na minha base de conhecimento, mas acabei de registrar sua dúvida para tentar descobrir a resposta o mais rápido possível e te responder futuramente."
                            else:
                                tool_output = "Não foi possível registrar a dúvida (sem conexão com o banco de dados no momento)."
                        except Exception as e:
                            tool_output = f"Erro ao registrar dúvida: {str(e)}"

                    # Native Google Calendar Tool Handlers
                    elif func_name in (
                        "google_calendar_criar_evento",
                        "google_calendar_listar_eventos",
                        "google_calendar_atualizar_evento",
                        "google_calendar_deletar_evento",
                        "google_calendar_buscar_eventos",
                        "google_calendar_verificar_disponibilidade"
                    ):
                        try:
                            import traceback
                            from google_calendar import GoogleCalendarService
                            agent_id = getattr(config, 'id', None)
                            print(f"[GCAL DEBUG] ÔûÂ func={func_name} | agent_id={agent_id} | db={db is not None}")
                            if not agent_id or not db:
                                raise ValueError("agent_id ou db não disponível para Google Calendar")
                            
                            gcal = GoogleCalendarService(agent_id, db)
                            func_args = json.loads(func_args_str)
                            print(f"[GCAL DEBUG] ÔûÂ args recebidos: {func_args}")
                            
                            if func_name == "google_calendar_criar_evento":
                                print(f"[GCAL DEBUG] ÔûÂ Iniciando create_event...")
                                creds = await gcal.get_credentials()
                                print(f"[GCAL DEBUG] ÔûÂ credentials: {creds}")
                                if creds:
                                    print(f"[GCAL DEBUG] ÔûÂ token_expired={creds.expired} | has_refresh={bool(creds.refresh_token)}")
                                # Trata convidados (string csv ou lista)
                                convidados_raw = func_args.get("convidados")
                                if convidados_raw:
                                    if isinstance(convidados_raw, str):
                                        convidados_raw = [e.strip() for e in convidados_raw.split(',') if e.strip()]
                                event = await gcal.create_event(
                                    summary=func_args.get("titulo"),
                                    start_time=func_args.get("inicio"),
                                    end_time=func_args.get("fim"),
                                    description=func_args.get("descricao"),
                                    location=func_args.get("local"),
                                    attendees=convidados_raw,
                                    recurrence=func_args.get("recorrencia"),
                                    color=func_args.get("cor")
                                )
                                print(f"[GCAL DEBUG] ÔûÂ result event: {event}")
                                if event:
                                    convidados_str = ""
                                    if event.get("attendees"):
                                        convidados_str = f" | Convidados: {', '.join(a.get('email','') for a in event['attendees'])}"
                                    recorrencia_str = ""
                                    if event.get("recurrence"):
                                        recorrencia_str = f" | Recorrência: {event['recurrence'][0]}"
                                    tool_output = json.dumps({
                                        "sucesso": True,
                                        "evento_id": event.get("id"),
                                        "link": event.get("htmlLink"),
                                        "titulo": event.get("summary"),
                                        "inicio": event.get("start", {}).get("dateTime"),
                                        "fim": event.get("end", {}).get("dateTime"),
                                        "cor": event.get("colorId"),
                                        "convidados": [a.get("email") for a in event.get("attendees", [])],
                                        "recorrente": bool(event.get("recurrence"))
                                    }, ensure_ascii=False)
                                else:
                                    tool_output = "Erro: Não foi possível criar o evento. Verifique se o Google Calendar está conectado."

                            elif func_name == "google_calendar_listar_eventos":
                                time_min = func_args.get("inicio")
                                time_max = func_args.get("fim")
                                events = await gcal.list_events(
                                    max_results=func_args.get("max_resultados", 5),
                                    time_min=time_min,
                                    time_max=time_max
                                )
                                if events:
                                    lines = []
                                    for e in events:
                                        start = e.get('start', {}).get('dateTime', e.get('start', {}).get('date', 'Sem data'))
                                        end = e.get('end', {}).get('dateTime', e.get('end', {}).get('date', ''))
                                        attendees_str = ""
                                        if e.get('attendees'):
                                            emails = [a.get('email', '') for a in e['attendees']]
                                            attendees_str = f" | Convidados: {', '.join(emails)}"
                                        color_str = f" | Cor: {e.get('colorId', 'padrão')}" if e.get('colorId') else ""
                                        desc_str = f" | Descrição: {e.get('description', '')[:80]}" if e.get('description') else ""
                                        lines.append(
                                            f"ÔÇó ID: `{e.get('id')}` | {e.get('summary', 'Sem título')} "
                                            f"| Início: {start} | Fim: {end}"
                                            f"{color_str}{attendees_str}{desc_str}"
                                        )
                                    label = "­ƒùé´©Å Eventos no período solicitado" if (time_min or time_max) else "📅 Próximos eventos"
                                    tool_output = f"{label}:\n" + "\n".join(lines)
                                else:
                                    tool_output = "Nenhum evento encontrado no período solicitado."


                            elif func_name == "google_calendar_atualizar_evento":
                                convidados_raw = func_args.get("convidados")
                                if convidados_raw and isinstance(convidados_raw, str):
                                    convidados_raw = [e.strip() for e in convidados_raw.split(',') if e.strip()]
                                updated = await gcal.update_event(
                                    event_id=func_args.get("evento_id"),
                                    summary=func_args.get("titulo"),
                                    start_time=func_args.get("inicio"),
                                    end_time=func_args.get("fim"),
                                    description=func_args.get("descricao"),
                                    location=func_args.get("local"),
                                    attendees=convidados_raw,
                                    recurrence=func_args.get("recorrencia"),
                                    color=func_args.get("cor")
                                )
                                if updated:
                                    tool_output = f"✅ Evento atualizado com sucesso! Título: '{updated.get('summary')}' | Link: {updated.get('htmlLink')}"
                                else:
                                    tool_output = "Erro: Não foi possível atualizar o evento."

                            elif func_name == "google_calendar_deletar_evento":
                                sucesso = await gcal.delete_event(event_id=func_args.get("evento_id"))
                                tool_output = "✅ Evento removido da agenda com sucesso." if sucesso else "Erro: Não foi possível remover o evento."

                            elif func_name == "google_calendar_buscar_eventos":
                                events = await gcal.search_events(
                                    query=func_args.get("busca"),
                                    max_results=func_args.get("max_resultados", 5)
                                )
                                if events:
                                    lines = []
                                    for e in events:
                                        start = e.get('start', {}).get('dateTime', e.get('start', {}).get('date', 'Sem data'))
                                        lines.append(f"ÔÇó ID: `{e.get('id')}` | {e.get('summary', 'Sem título')} ÔÇö {start}")
                                    tool_output = f"🔍 Resultados para '{func_args.get('busca')}':\n" + "\n".join(lines)
                                else:
                                    tool_output = f"Nenhum evento encontrado para '{func_args.get('busca')}'."

                            elif func_name == "google_calendar_verificar_disponibilidade":
                                result = await gcal.check_availability(
                                    start_time=func_args.get("inicio"),
                                    end_time=func_args.get("fim")
                                )
                                if result.get('livre') is True:
                                    tool_output = f"✅ O horário entre {func_args.get('inicio')} e {func_args.get('fim')} está LIVRE na agenda."
                                elif result.get('livre') is False:
                                    conflitos = result.get('conflitos', [])
                                    conf_str = "; ".join([f"{c.get('start')} - {c.get('end')}" for c in conflitos])
                                    tool_output = f"⚠️´©Å O horário está OCUPADO. Conflitos: {conf_str}"
                                else:
                                    tool_output = f"Erro ao verificar disponibilidade: {result.get('erro', 'desconhecido')}"
                        except Exception as e:
                            tb = traceback.format_exc()
                            print(f"[GCAL ERROR] Ô£û {type(e).__name__}: {e}")
                            print(f"[GCAL ERROR] Ô£û Traceback:\n{tb}")
                            tool_output = f"Erro ao acessar Google Calendar: {type(e).__name__}: {str(e)}"


                    
                    elif func_name == "transferir_atendimento":
                        try:
                            func_args = json.loads(tc.function.arguments)
                            destino = func_args.get("destino")
                            motivo = func_args.get("motivo")
                            
                            # Gerar o resumo estruturado (4 pontos)
                            summary = await generate_handoff_summary(history + [message_content])
                            
                            handoff_data = {
                                "handoff": True,
                                "destino": destino,
                                "motivo": motivo,
                                "resumo": summary
                            }
                            
                            # Retornar imediatamente para o backend processar a troca
                            return {
                                "content": f"🔄 Transferindo para {destino}...\n\n### Resumo da Conversa para o novo atendente:\n{summary}",
                                "usage": UsageLog(mini_prompt_tokens, mini_completion_tokens, main_prompt_tokens, main_completion_tokens),
                                "model": config.model,
                                "handoff_data": handoff_data,
                                "debug": {
                                    "handoff": destino,
                                    "summary": summary
                                }
                            }
                        except Exception as e:
                            tool_output = f"Erro ao processar transferência: {str(e)}"

                    # Track this call for the Raio-X thought
                    performed_tool_calls.append({
                        "name": func_name,
                        "args": func_args_str,
                        "output": str(tool_output)[:500] + "..." if len(str(tool_output)) > 500 else str(tool_output)
                    })

                    messages.append({
                        "tool_call_id": tc.id,
                        "role": "tool",
                        "name": func_name,
                        "content": str(tool_output)
                    })

                # Using 'user' role instead of 'system' because some compatibility layers (like Gemini)
                # might return an empty output if the final message in the chain is 'system'
                messages.append({"role": "user", "content": "A ferramenta retornou os dados acima. Por favor, forneça uma resposta final ao usuário baseada nessas informaç├Áes."})
            
        return {
            "content": "Desculpe, excedi o limite de processamento para esta solicitação.",
            "usage": None,
            "model": config.model,
            "tool_calls": None,
            "debug": {
                "full_prompt": [m if isinstance(m, dict) else m.model_dump() for m in messages],
                "rag_context": rag_context,
                "error": "Limit exceeded"
            }
        }
            
    except Exception as e:
        print(f"ÔØî Erro ao processar mensagem com modelo {config.model}: {e}")
        
        # Se tem fallback configurado, tentar com ele
        if config.fallback_model:
            print(f"🔄 Tentando com modelo de fallback: {config.fallback_model}")
            try:
                # Criar nova config com fallback como modelo principal (sem fallback recursivo)
                fallback_config = AgentConfig(
                    model=config.fallback_model,
                    fallback_model=None,  # Evitar recursão infinita
                    temperature=config.temperature,
                    top_p=config.top_p,
                    system_prompt=config.system_prompt,
                    context_window=config.context_window,
                    knowledge_base=config.knowledge_base
                )
                # Chamar recursivamente com config do fallback
                result = await process_message(message, history, fallback_config, tools, context_variables, db=db)
                result["model"] = f"{config.fallback_model} (fallback)"  # Indicar que usou fallback
                return result
            except Exception as fallback_error:
                print(f"ÔØî Fallback também falhou: {fallback_error}")
                return {
                    "content": "Desculpe, estou passando por uma instabilidade temporária no momento e não consegui gerar a resposta adequada. Por favor, tente novamente em alguns instantes.",
                    "usage": None,
                    "error": True,
                    "model": config.model,
                    "tool_calls": None,
                    "debug": {
                        "error_principal": str(e),
                        "error_fallback": str(fallback_error)
                    }
                }
        else:
            # Sem fallback configurado, retornar erro original de forma amigável
            return {
                "content": "Desculpe, estou passando por uma instabilidade sistêmica no meu núcleo de processamento e não pude processar sua mensagem. Nossa equipe já foi alertada, por favor tente novamente mais tarde.",
                "usage": None,
                "error": True,
                "model": config.model,
                "tool_calls": None,
                "debug": {
                    "error": str(e),
                    "full_prompt": [m if isinstance(m, dict) else m.model_dump() for m in messages] if 'messages' in locals() else [],
                    "rag_context": rag_context if 'rag_context' in locals() else "",
                    "rag_items": relevant_items if 'relevant_items' in locals() else []
                }
            }
