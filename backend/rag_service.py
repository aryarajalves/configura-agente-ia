import json
import os
import openai
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from models import KnowledgeItemModel, KnowledgeBaseModel, AgentConfigModel

load_dotenv()

async def call_rag_llm(messages: list, model: str = "gpt-4o-mini", fallback: str = None, response_format: dict = None, max_tokens: int = 500):
    """Helper to call LLM with fallback logic for RAG background tasks."""
    
    # Try 1: Configured Simple Model
    # Try 2: Configured Fallback
    # Try 3: GPT-4o-mini (Safety net)
    models_to_try = [model, fallback, "gpt-4o-mini"]
    
    last_error = None
    for m in models_to_try:
        if not m: continue
        
        from agent import get_openai_client
        from config_store import get_real_model_id
        
        client = get_openai_client(m)
        api_model = get_real_model_id(m)
        
        if not client: continue

        try:
            from config_store import format_ai_params
            
            base_params = {
                "messages": messages,
                "temperature": 0.0,
                "max_tokens": max_tokens
            }
            if response_format:
                base_params["response_format"] = response_format
                
            kwargs = format_ai_params(api_model, m, base_params)
            
            response = await client.chat.completions.create(**kwargs)
            return response
        except Exception as e:
            print(f"[RAG LLM ERROR] Model {m} failed: {e}")
            last_error = e
            continue
            
    if last_error:
        raise last_error
    else:
        raise Exception("Todos os modelos RAG falharam ou chaves não configuradas")

async def get_embedding(text: str):
    """Generates embedding for the given text using OpenAI."""
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None, None
            
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # Replace newlines
        text = text.replace("\n", " ")
        
        response = await client.embeddings.create(
            input=[text],
            model="text-embedding-3-small"
        )
        
        return response.data[0].embedding, response.usage
        
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None, None

async def get_batch_embeddings(texts: list[str]):
    """Generates embeddings for a list of texts in a single batch call using OpenAI."""
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return [], None
            
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # Replace newlines in all texts
        cleaned_texts = [t.replace("\n", " ") for t in texts]
        
        response = await client.embeddings.create(
            input=cleaned_texts,
            model="text-embedding-3-small"
        )
        
        embeddings = [item.embedding for item in response.data]
        return embeddings, response.usage
        
    except Exception as e:
        print(f"Error generating batch embeddings: {e}")
        return [], None

async def detect_language(text: str, model: str = "gpt-4o-mini", fallback: str = None):
    """Uses a cheap LLM call to detect the query language for PostgreSQL FTS."""
    try:
        # Mapping to valid PostgreSQL configurations
        valid_configs = ["portuguese", "english", "spanish", "french", "german", "simple"]
        
        response = await call_rag_llm(
            model=model,
            fallback=fallback,
            max_tokens=10,
            messages=[
                {"role": "system", "content": f"Identifique o idioma do texto. Responda APENAS com uma destas palavras: {', '.join(valid_configs)}. Diferencie entre português do Brasil e de Portugal apenas internamente, mas ambos devem retornar 'portuguese'."},
                {"role": "user", "content": text}
            ]
        )
        detected = response.choices[0].message.content.strip().lower()
        return (detected if detected in valid_configs else "simple"), response.usage
    except:
        return "simple", None

async def translate_to_portuguese(text: str, model: str = "gpt-4o-mini", fallback: str = None):
    """Translates non-portuguese queries to Portuguese for better RAG matching."""
    try:
        response = await call_rag_llm(
            model=model,
            fallback=fallback,
            max_tokens=200,
            messages=[
                {"role": "system", "content": "Traduza o texto do usuário para o Português do Brasil de forma natural e técnica. Mantenha nomes próprios ou códigos técnicos inalterados. RESPONDA APENAS COM A TRADUÇÃO."},
                {"role": "user", "content": text}
            ]
        )
        return response.choices[0].message.content.strip(), response.usage
    except:
        return text, None # Fallback to original

LANG_MAP = {
    "pt-br": "Português do Brasil",
    "pt-pt": "Português de Portugal (Europeu)",
    "en": "English",
    "es": "Español",
    "fr": "Français",
    "de": "Deutsch",
    "it": "Italiano",
    "ja": "Japanese (日本語)",
    "zh": "Chinese Simplified (中文简体)",
    "zh-tw": "Chinese Traditional (中文繁體)",
    "ar": "Arabic (العربية)",
    "ko": "Korean (한국어)",
    "ru": "Russian (Русский)",
    "hi": "Hindi (हिन्दी)",
    "nl": "Dutch (Nederlands)",
    "pl": "Polish (Polski)",
    "tr": "Turkish (Türkçe)",
    "sv": "Swedish (Svenska)",
    "no": "Norwegian (Norsk)",
    "da": "Danish (Dansk)",
    "fi": "Finnish (Suomi)",
    "el": "Greek (Ελληνικά)",
    "cs": "Czech (Čeština)",
    "hu": "Hungarian (Magyar)",
    "ro": "Romanian (Română)",
    "uk": "Ukrainian (Українська)",
    "id": "Indonesian (Bahasa Indonesia)",
    "ms": "Malay (Bahasa Malaysia)",
    "th": "Thai (ภาษาไทย)",
    "vi": "Vietnamese (Tiếng Việt)",
    "he": "Hebrew (עברית)",
    # Legacy aliases kept for backward compat
    "portuguese": "Português do Brasil",
    "english": "English",
    "spanish": "Español",
    "french": "Français",
    "german": "Deutsch",
    "italian": "Italiano",
    "japanese": "Japanese (日本語)",
    "chinese": "Chinese Simplified (中文简体)",
    "arabic": "Arabic (العربية)",
}

async def detect_message_language(text: str, model: str = "gpt-4o-mini", fallback: str = None):
    """Detects the language of a user message for response translation purposes.
    Returns a short language code (e.g. 'pt-br', 'en', 'es') or None on failure."""
    valid_codes = list(LANG_MAP.keys())
    try:
        response = await call_rag_llm(
            model=model,
            fallback=fallback,
            max_tokens=10,
            messages=[
                {"role": "system", "content": (
                    "Detect the language of the user's text. "
                    f"Respond ONLY with one of these codes: {', '.join(valid_codes)}. "
                    "Use 'pt-br' for Brazilian Portuguese and 'pt-pt' for European Portuguese. "
                    "If unsure, respond with 'en'."
                )},
                {"role": "user", "content": text}
            ]
        )
        code = response.choices[0].message.content.strip().lower()
        return (code if code in LANG_MAP else None), response.usage
    except:
        return None, None

async def translate_to_language(text: str, target_lang: str, model: str = "gpt-4o-mini", fallback: str = None):
    """Translates text to the specified target language."""
    target_name = LANG_MAP.get(target_lang, target_lang)
    try:
        response = await call_rag_llm(
            model=model,
            fallback=fallback,
            max_tokens=2000,
            messages=[
                {"role": "system", "content": f"Translate the user's text to {target_name}. Preserve formatting, emojis, line breaks, and technical terms. Respond ONLY with the translation, nothing else."},
                {"role": "user", "content": text}
            ]
        )
        return response.choices[0].message.content.strip(), response.usage
    except:
        return text, None  # Fallback to original on error

async def rerank_results(query: str, items: list[dict], model: str = "gpt-4o-mini", fallback: str = None, q_label: str = "Pergunta", a_label: str = "Resposta", m_label: str = "Metadado"):
    """Uses LLM to re-rank the top results for maximum precision."""
    if not items or len(items) <= 1:
        return items, None
        
    try:
        # Prepare the list for the LLM to evaluate
        context_to_rank = ""
        for i, item in enumerate(items):
            meta_str = f"{m_label}: {item.get('metadata_val', '')}\n" if item.get('metadata_val') else ""
            context_to_rank += f"[{i}] {meta_str}{q_label}: {item['question']}\n{a_label}: {item['answer']}\n\n"
            
        prompt = f"""
Sua tarefa é reordenar os conhecimentos abaixo do mais relevante para o menos relevante em relação à Pergunta do Usuário.

Pergunta do Usuário: "{query}"

Conhecimentos Disponíveis:
{context_to_rank}

Responda APENAS com uma lista JSON de índices na nova ordem de importância.
Exemplo de resposta: [2, 0, 1]
"""
        response = await call_rag_llm(
            model=model,
            fallback=fallback,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}]
        )
        
        content = response.choices[0].message.content.strip()
        try:
            # Tenta limpar markdown se houver
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # Remove possíveis textos explicativos antes/depois do JSON
            if content.find("[") != -1:
                content = content[content.find("["):content.rfind("]")+1]
            elif content.find("{") != -1:
                content = content[content.find("{"):content.rfind("}")+1]

            new_order = json.loads(content)
            if isinstance(new_order, dict) and new_order.values():
                 new_order = list(new_order.values())[0] if isinstance(list(new_order.values())[0], list) else []
            elif isinstance(new_order, dict):
                 new_order = []
        except Exception as json_e:
            print(f"[RERANK JSON ERROR] Failed to parse: {json_e} | Content: {content[:100]}...")
            new_order = []

        reranked_items = []
        seen_indices = set()
        for idx in new_order:
            if 0 <= idx < len(items) and idx not in seen_indices:
                items[idx]["search_type"] = "hybrid + reranked"
                reranked_items.append(items[idx])
                seen_indices.add(idx)
        
        for i, item in enumerate(items):
            if i not in seen_indices:
                reranked_items.append(item)
                
        return reranked_items, response.usage
        
    except Exception as e:
        print(f"[RERANK ERROR] Failed to rerank: {e}")
        return items, None

async def evaluate_rag_relevance(query: str, items: list[dict], model: str = "gpt-4o-mini", fallback: str = None, q_label: str = "Pergunta", a_label: str = "Resposta", m_label: str = "Metadado"):
    """Agentic step: Validates each retrieved item and returns only those that are truly relevant."""
    if not items:
        return [], None
        
    # Security bypass: If an item has a very high vector similarity, keep it regardless of evaluation
    # (Distance < 0.45 is usually a very strong match in cosine distance)
    TRUST_THRESHOLD = 0.45
    trusted_items = [i for i in items if i.get("distance") is not None and i.get("distance") < TRUST_THRESHOLD]
    
    # If the strongest item is already very trusted, we might still want to filter the rest
    # But for simplicity, let's proceed to evaluate everything that's not already trusted
    
    try:
        context = ""
        for i, item in enumerate(items):
            meta_prefix = f"{m_label}: {item.get('metadata_val', '')} | " if item.get('metadata_val') else ""
            context += f"Conhecimento [{i}] (ID: {item['id']}): {meta_prefix}{item['question'] if q_label == 'Pergunta' else q_label + ': ' + item['question']} -> {item['answer'][:400] if a_label == 'Resposta' else a_label + ': ' + item['answer'][:400]}\n"
            
        prompt = f"""
Sua tarefa é agir como um filtro de relevância para um sistema RAG (Busca de Conhecimento).
Pergunta do Usuário: "{query}"

Conhecimentos Recrutados:
{context}

Analise item por item e determine quais são ÚTEIS para responder à pergunta. 
Siga estas diretrizes:
1. Seja PERMISSIVO: Se o assunto for o mesmo, mantenha o item.
2. Sinônimos: 'Matriz' e 'Matriz de Fidelidade' indicam o mesmo assunto. 'Dívidas' e 'Débitos' também.
3. Parcialmente Útil: Se o conhecimento explica como chegar na resposta ou dá contexto relacionado, é ÚTIL.
4. Lixo/Irrelevante: Apenas descarte se o assunto for totalmente diferente (ex: o usuário pergunta de 'Preços' e o item fala de 'Faltas de Funcionários').

Responda APENAS com um objeto JSON contendo a lista de índices considerados úteis.
Exemplo: {{"useful_indices": [0, 2]}}
Se NADA for minimamente útil, responda: {{"useful_indices": []}}
"""
        response = await call_rag_llm(
            model="gpt-4o-mini", 
            fallback=model,
            max_tokens=200,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}]
        )
        
        content = response.choices[0].message.content.strip()
        try:
            data = json.loads(content)
            useful_indices = data.get("useful_indices", [])
        except:
            # Fallback if JSON fails but we have SIM/NÃO or something
            if "SIM" in content.upper() or "[" in content:
                useful_indices = list(range(len(items))) # Keep all on error if it looks positive
            else:
                useful_indices = []

        # Merge trusted items with items chosen by LLM
        final_indices = set(useful_indices)
        for i, item in enumerate(items):
            if item.get("distance") is not None and item.get("distance") < TRUST_THRESHOLD:
                final_indices.add(i)
        
        relevant_items = [items[idx] for idx in sorted(list(final_indices)) if idx < len(items)]
        
        # If we had items but everything was filtered, let's at least keep the TOP 1 if its distance is decent
        if not relevant_items and items and items[0].get("distance", 1.0) < 0.6:
             relevant_items = [items[0]]

        return relevant_items, response.usage
            
    except Exception as e:
        print(f"[AGENTIC RAG ERROR] Evaluation failed: {e}")
        return items, None

async def generate_multi_queries(query: str, count: int = 3, model: str = "gpt-4o-mini", fallback: str = None):
    """Generates multiple variations of the query to improve retrieval coverage."""
    try:
        prompt = f"""
Sua tarefa é gerar {count} variações curtas e diferentes da pergunta do usuário para ajudar na busca em um banco de dados.
Gere perguntas que foquem em diferentes palavras-chave ou intenções contidas na pergunta original.

Pergunta Original: "{query}"

Responda APENAS com uma lista JSON de strings.
Exemplo: ["pergunta 1", "pergunta 2", "pergunta 3"]
"""
        response = await call_rag_llm(
            model=model,
            fallback=fallback,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}]
        )
        
        content = response.choices[0].message.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
            
        data = json.loads(content)
        if isinstance(data, dict):
            queries = list(data.values())[0] if isinstance(list(data.values())[0], list) else []
        else:
            queries = data
            
        if query not in queries:
            queries.append(query)
            
        return queries[:count+1], response.usage
    except Exception as e:
        print(f"[MULTI-QUERY ERROR] Failed to generate: {e}")
        return [query], None

from sqlalchemy.orm import selectinload

async def search_knowledge_base(
    db: AsyncSession, 
    query: str, 
    kb_id: int = None,
    kb_ids: list[int] = None, # New: support multiple IDs
    agent_id: int = None,
    limit: int = 5,
    similarity_threshold: float = 0.5,
    model: str = "gpt-4o-mini",
    fallback_model: str = None,
    # Forçar configurações (usado pelo simulador)
    force_translation: bool = None,
    force_multi_query: bool = None,
    force_rerank: bool = None,
    force_agentic_eval: bool = None,
    force_parent_expansion: bool = None
):
    """
    Searches for relevant knowledge items using vector similarity.
    Supports single KB, multiple KBs, or agent-linked KBs.
    """
    
    # 1. Determine target KB IDs
    target_ids = set()
    rag_translation_enabled = False
    rag_multi_query_enabled = False
    rag_rerank_enabled = True
    rag_agentic_eval_enabled = True
    rag_parent_expansion_enabled = True
    
    if kb_ids:
        target_ids.update(kb_ids)
    if kb_id:
        target_ids.add(kb_id)
        
    if agent_id:
        # Fetch agent with linked KBs
        stmt = (
            select(AgentConfigModel)
            .where(AgentConfigModel.id == agent_id)
            .options(selectinload(AgentConfigModel.knowledge_bases))
        )
        result = await db.execute(stmt)
        agent = result.scalars().first()
        
        if agent:
            # Add M2M linked bases
            if not target_ids:
                for kb in agent.knowledge_bases:
                    target_ids.add(kb.id)
                # Add legacy single linked base if exists
                if agent.knowledge_base_id:
                    target_ids.add(agent.knowledge_base_id)
                    
            if hasattr(agent, 'rag_translation_enabled'):
                rag_translation_enabled = agent.rag_translation_enabled
                rag_multi_query_enabled = agent.rag_multi_query_enabled
                rag_rerank_enabled = agent.rag_rerank_enabled
                rag_agentic_eval_enabled = agent.rag_agentic_eval_enabled
                rag_parent_expansion_enabled = agent.rag_parent_expansion_enabled
                
    if force_translation is not None: rag_translation_enabled = force_translation
    if force_multi_query is not None: rag_multi_query_enabled = force_multi_query
    if force_rerank is not None: rag_rerank_enabled = force_rerank
    if force_agentic_eval is not None: rag_agentic_eval_enabled = force_agentic_eval
    if force_parent_expansion is not None: rag_parent_expansion_enabled = force_parent_expansion
            
    if not target_ids:
        return [], None

    try:
        # Usage tracking
        total_prompt_tokens = 0
        total_completion_tokens = 0
        
        def add_usage(usage):
            nonlocal total_prompt_tokens, total_completion_tokens
            if usage:
                p = getattr(usage, 'prompt_tokens', 0)
                c = getattr(usage, 'completion_tokens', 0)
                # Handle total_tokens if prompt/completion are missing (e.g. embeddings)
                if p == 0 and hasattr(usage, 'total_tokens'):
                    p = usage.total_tokens
                
                print(f"[RAG USAGE DEBUG] Adding: p={p}, c={c}")
                total_prompt_tokens += p
                total_completion_tokens += c

        # 2. Query Transformation (Multi-Query)
        detected_lang = "portuguese"
        if rag_translation_enabled:
            detected_lang, u_lang = await detect_language(query, model=model, fallback=fallback_model)
            add_usage(u_lang)
        
        if rag_multi_query_enabled:
            query_variations, u_multi = await generate_multi_queries(query, count=2, model=model, fallback=fallback_model)
            add_usage(u_multi)
        else:
            query_variations = [query]
        
        # 3. Process each query variation
        all_scores = {} # Global score aggregator for all queries
        k = 60 # RRF Constant

        for q_var in query_variations:
            # A. Translate variation if needed
            search_q = q_var
            if rag_translation_enabled and detected_lang != "portuguese" and detected_lang != "simple":
                search_q, u_trans = await translate_to_portuguese(q_var, model=model, fallback=fallback_model)
                add_usage(u_trans)
                
            print(f"[RAG DEBUG] Buscando variação: '{q_var}' -> '{search_q}'")

            # B. Get Embeddings
            q_embedding, u_emb = await get_embedding(search_q)
            add_usage(u_emb)
            
            if not q_embedding: continue

            try:
                # C. Vector Search per variation
                dist_col = KnowledgeItemModel.embedding.cosine_distance(q_embedding).label("distance")
                v_stmt = select(KnowledgeItemModel, dist_col).where(
                    KnowledgeItemModel.knowledge_base_id.in_(target_ids),
                    KnowledgeItemModel.embedding.is_not(None)
                ).order_by(dist_col).limit(limit)
                
                v_res = await db.execute(v_stmt)
                for rank, (item, dist) in enumerate(v_res.all(), start=1):
                    if item.id not in all_scores:
                        all_scores[item.id] = {"item": item, "score": 0.0, "vector_dist": dist}
                    all_scores[item.id]["score"] += 1.0 / (k + rank)
                    # Keep the best distance found across variations
                    if dist < all_scores[item.id].get("vector_dist", 1.0):
                        all_scores[item.id]["vector_dist"] = dist

                # D. Keyword Search (FTS) per variation
                # We search against question, answer and metadata_val
                fts_q = text(f"to_tsvector('portuguese', coalesce(question, '') || ' ' || coalesce(answer, '') || ' ' || coalesce(metadata_val, '')) @@ websearch_to_tsquery('portuguese', :q)")
                f_stmt = select(KnowledgeItemModel).where(
                    KnowledgeItemModel.knowledge_base_id.in_(target_ids),
                    fts_q
                ).params(q=search_q).limit(limit)

                f_res = await db.execute(f_stmt)
                for rank, item in enumerate(f_res.scalars().all(), start=1):
                    if item.id not in all_scores:
                        all_scores[item.id] = {"item": item, "score": 0.0}
                    all_scores[item.id]["score"] += 1.0 / (k + rank)
            except Exception as e:
                print(f"[RAG ERROR] Variação falhou: {e}")
                continue

        # 4. Filter and prepare for Reranking
        hybrid_results = sorted(all_scores.values(), key=lambda x: x["score"], reverse=True)[:limit * 3]
        
        final_items = []
        for res in hybrid_results:
            item = res["item"]
            distance = res.get("vector_dist")
            # Convert cosine distance to a 0-1 similarity score
            # similarity = 1 - distance (for cosine distance)
            similarity_score = 0.0
            if distance is not None:
                similarity_score = max(0, min(1.0, 1.0 - distance))
            
            final_items.append({
                "id": item.id,
                "question": item.question,
                "answer": item.answer,
                "metadata_val": item.metadata_val,
                "category": item.category,
                "metadata": json.loads(item.source_metadata) if item.source_metadata else None,
                "kb_id": item.knowledge_base_id,
                "rrf_score": res["score"],
                "distance": distance,
                "relevance_score": round(similarity_score, 4),
                "search_type": "multi-query-hybrid"
            })

        if not final_items:
            return [], None

        # 5. Reranking (Contexto traduzido se necessário para avaliação)
        main_search_q = query
        if rag_translation_enabled and detected_lang != "portuguese" and detected_lang != "simple":
            main_search_q, u_trans_final = await translate_to_portuguese(query, model=model, fallback=fallback_model)
            add_usage(u_trans_final)

        # Get Labels for the first KB in target_ids (best effort)
        q_label, a_label, m_label = "Pergunta", "Resposta", "Metadado"
        if target_ids:
            first_kb_id = list(target_ids)[0]
            kb_res = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == first_kb_id))
            kb = kb_res.scalars().first()
            if kb:
                q_label = kb.question_label or "Pergunta"
                a_label = kb.answer_label or "Resposta"
                m_label = kb.metadata_label or "Metadado"

        if rag_rerank_enabled:
            reranked_items, u_rerank = await rerank_results(main_search_q, final_items, model=model, fallback=fallback_model, q_label=q_label, a_label=a_label, m_label=m_label)
            add_usage(u_rerank)
        else:
            reranked_items = final_items
            
        # 7. Parent Document Retrieval (Context Expansion)
        expanded_items = []
        if rag_parent_expansion_enabled:
            for res_item in reranked_items[:limit]:
                item_id = res_item.get("id")
                
                stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.id == item_id)
                db_res = await db.execute(stmt)
                db_item = db_res.scalars().first()
                
                if db_item and db_item.parent_id:
                    parent_stmt = select(KnowledgeItemModel).where(KnowledgeItemModel.id == db_item.parent_id)
                    parent_res = await db.execute(parent_stmt)
                    parent_item = parent_res.scalars().first()
                    
                    if parent_item:
                        print(f"[RAG DEBUG] Expandindo contexto: Filho({db_item.id}) -> Pai({parent_item.id})")
                        expanded_items.append({
                            "id": parent_item.id,
                            "question": parent_item.question,
                            "answer": parent_item.answer,
                            "metadata_val": parent_item.metadata_val,
                            "category": parent_item.category,
                            "metadata": json.loads(parent_item.source_metadata) if parent_item.source_metadata else None,
                            "kb_id": parent_item.knowledge_base_id,
                            "rrf_score": res_item.get("rrf_score"),
                            # Preserve distance from the child item so TRUST_THRESHOLD still applies
                            "distance": res_item.get("distance"),
                            "relevance_score": res_item.get("relevance_score"),
                            "search_type": "parent_expanded"
                        })
                        continue
                
                expanded_items.append(res_item)
        else:
            expanded_items = reranked_items[:limit]

        # 8. Agentic Selection/Filtering (Self-Correction)
        # Use the original (or translated) search term to evaluate
        final_filtered_items = expanded_items[:limit]
        if rag_agentic_eval_enabled:
            eval_input = expanded_items[:limit]
            final_filtered_items, u_eval = await evaluate_rag_relevance(main_search_q, eval_input, model=model, fallback=fallback_model, q_label=q_label, a_label=a_label, m_label=m_label)
            add_usage(u_eval)
            
            # Safety net: if eval returned nothing but raw results were good, keep the top one
            # (prevents the filter from being overly aggressive and returning empty on valid queries)
            if not final_filtered_items and eval_input:
                best = eval_input[0]
                best_dist = best.get('distance')
                # Only keep if the raw vector distance was good (below 0.65)
                if best_dist is not None and best_dist < 0.65:
                    print(f"[RAG DEBUG] ⚠️ Eval filtrou tudo, mas dist={best_dist:.4f} é boa. Mantendo top-1 como fallback.")
                    final_filtered_items = [best]
        
        class RAGUsage:
            def __init__(self, p, c, model):
                self.prompt_tokens = p
                self.completion_tokens = c
                self.model = model

        rag_usage_obj = RAGUsage(total_prompt_tokens, total_completion_tokens, model)
        
        if not final_filtered_items:
            print(f"[RAG DEBUG] 🛑 Agentic Filter: Conhecimentos considerados irrelevantes.")
            return [], rag_usage_obj

        return final_filtered_items, rag_usage_obj
            
    except Exception as e:
        print(f"Hybrid search failed: {e}")
        # Fallback to empty results if something goes wrong
        return [], None

async def calculate_coverage(
    db: AsyncSession,
    questions: list[str],
    kb_id: int,
    similarity_threshold_low: float = 0.65,
    similarity_threshold_high: float = 0.82
):
    results = []
    
    for question in questions:
        # Get best single match
        matches, _ = await search_knowledge_base(db, query=question, kb_id=kb_id, limit=1)
        
        status = "red"
        best_match = None
        score = 0.0
        
        if matches:
            best = matches[0]
            # Use rrf_score if distance is not available (Hybrid search case)
            score = best.get('rrf_score', 0.0)
            if 'distance' in best:
                score = 1.0 - best['distance']
            
            # Normalize score just in case
            if score > 1.0: score = 1.0
            if score < -1.0: score = -1.0
            
            best_match = best
            
            if score >= similarity_threshold_high:
                status = "green"
            elif score >= similarity_threshold_low:
                status = "yellow"
            else:
                status = "red"
        else:
            status = "red"
            
        results.append({
            "question": question,
            "status": status,
            "score": score,
            "best_match": best_match
        })
        
    return results
