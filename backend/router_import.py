from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Dict, Any
import json
from database import get_db
from models import KnowledgeItemModel, KnowledgeBaseModel
from smart_importer import extract_text_from_pdf, extract_text_from_image, chunk_text, generate_qa_from_text, generate_global_qa, extract_text_from_url, detect_sections, extract_visual_content_from_section
from rag_service import get_embedding
import asyncio
import uuid
import re
import re
from models import InteractionLog

async def _log_extraction_cost(db: AsyncSession, kb_id: int, total_usage: dict, source: str):
    total_tokens = total_usage.get("input_tokens", 0) + total_usage.get("output_tokens", 0)
    if total_tokens > 0:
        from config_store import USD_TO_BRL
        log_model = list(total_usage["models"])[0] if total_usage.get("models") else "gpt-4o-mini"
        log = InteractionLog(
            session_id=f"SYS_EXTRACTION_KB_{kb_id}",
            user_message=f"Extração RAG ({source})",
            agent_response="Documentos processados via OpenAI.",
            model_used=log_model,
            input_tokens=total_usage.get("input_tokens", 0),
            output_tokens=total_usage.get("output_tokens", 0),
            cost_usd=total_usage.get("cost_usd", 0.0),
            cost_brl=total_usage.get("cost_usd", 0.0) * USD_TO_BRL
        )
        db.add(log)
        await db.commit()

router = APIRouter()
@router.post("/knowledge-bases/{kb_id}/preview-url-import")
async def preview_url_import(
    kb_id: int,
    url: str = Form(...),
    use_ai_qa: bool = Form(True),
    mode: str = Form("global"),
    user_suggestions: str | None = Form(None),
    global_qa_count: int = Form(20),
    extraction_type: str = Form("suggestions"),
    chunk_size: int = Form(1000),
    model: str = Form("gpt-4o-mini"),
    db: AsyncSession = Depends(get_db)
):
    text = await extract_text_from_url(url)
    
    if not text.strip():
        return {"error": "Nenhum conteúdo útil encontrado na URL. Verifique se o site permite acesso ou tente outra URL."}
        
    chunks = chunk_text(text, chunk_size)
    preview_items = []
    
    if not use_ai_qa:
        for i, c in enumerate(chunks[:20]): # Limit preview for raw text
            preview_items.append({
                "id": str(uuid.uuid4()),
                "type": "chunk",
                "question": f"Conteúdo da URL (Parte {i+1})", 
                "answer": c["text"],
                "category": "Web Scraping",
                "selected": True
            })
            
    from config_store import MODEL_INFO, USD_TO_BRL
    total_usage = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "models": set()}

    def update_usage(usage_dict):
        if not usage_dict: return
        model = usage_dict.get("model")
        total_usage["input_tokens"] += usage_dict.get("input_tokens", 0)
        total_usage["output_tokens"] += usage_dict.get("output_tokens", 0)
        total_usage["models"].add(model)
        pricing = MODEL_INFO.get(model, MODEL_INFO.get("gpt-4o-mini", list(MODEL_INFO.values())[0]))
        cost = (usage_dict.get("input_tokens", 0) * pricing["input"]) + \
               (usage_dict.get("output_tokens", 0) * pricing["output"])
        total_usage["cost_usd"] += cost

    def find_relevant_snippet(answer, full_text):
        # Fallback: tries to find a snippet of the answer in the full text 
        # or just returns a chunk related to keywords
        words = [w for w in re.findall(r'\w+', answer) if len(w) > 4]
        if not words: return full_text[:1000]
        
        # Simple keyword search
        for word in words[:5]:
            idx = full_text.lower().find(word.lower())
            if idx != -1:
                start = max(0, idx - 200)
                end = min(len(full_text), idx + 800)
                return full_text[start:end] + "..."
        return full_text[:1000]

    if use_ai_qa:
        qas, usage = await generate_global_qa(text, global_qa_count, user_suggestions, extraction_type, model)
        update_usage(usage)
        for qa in qas:
            preview_items.append({
                "id": str(uuid.uuid4()),
                "type": "ai_qa",
                "question": qa.get('pergunta', 'Pergunta Sugerida'),
                "answer": qa.get('resposta', 'Resposta Sugerida'),
                "category": qa.get('categoria', 'Web Scraping'),
                "source_text": text[:4000] if text else "",
                "selected": True
            })

    if use_ai_qa:
        await _log_extraction_cost(db, kb_id, total_usage, "Importação de URL")

    return {
        "preview": preview_items, 
        "total_text_length": len(text),
        "usage": {
            "input_tokens": total_usage["input_tokens"],
            "output_tokens": total_usage["output_tokens"],
            "total_tokens": total_usage["input_tokens"] + total_usage["output_tokens"],
            "cost_usd": round(total_usage["cost_usd"], 6),
            "cost_brl": round(total_usage["cost_usd"] * USD_TO_BRL, 4),
            "models": list(total_usage["models"])
        }
    }

@router.post("/knowledge-bases/{kb_id}/preview-smart-import")
async def preview_smart_import(
    kb_id: int,
    file: UploadFile = File(...),
    start_page: int = Form(1),
    end_page: int | None = Form(None),
    chunk_size: int = Form(1000),
    use_ai_qa: bool = Form(False),
    qa_count_per_chunk: int = Form(2),
    mode: str = Form("chunk"), # chunk | global | sections
    user_suggestions: str | None = Form(None),
    global_qa_count: int = Form(20),
    extraction_type: str = Form("suggestions"),
    model: str = Form("gpt-4o-mini"),
    qa_per_section: int = Form(8),
    use_vision: bool = Form(False),
    db: AsyncSession = Depends(get_db)
):
    print(f"DEBUG: preview_smart_import called. KB={kb_id}, Type={extraction_type}, Count={global_qa_count}, Mode={mode}")
    
    import tempfile
    import os
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        tmp_path = tmp.name

    filename = file.filename.lower()
    
    try:
        if filename.endswith((".png", ".jpg", ".jpeg", ".webp")):
            # Imagens ainda usam bytes por enquanto (geralmente pequenas)
            with open(tmp_path, "rb") as f:
                content = f.read()
            pages_data = await extract_text_from_image(content)
        else:
            # PDFs usam o caminho do arquivo (streaming)
            pages_data = await extract_text_from_pdf(tmp_path, start_page, end_page)
    except Exception as e:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        return {"error": f"Erro ao processar arquivo: {str(e)}"}
    
    if not pages_data:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        return {"error": "Nenhum texto extraído. Verifique se o arquivo contém texto legível."}
        
    full_text = "\n".join([p["text"] for p in pages_data])
    
    # Always chunk for storage structure, even if not used for Q&A generation per chunk
    chunks_with_meta = chunk_text(pages_data, chunk_size)
    preview_items = []
    
    # 1. Raw Chunks (Only if AI is disabled, to avoid clutter)
    if not use_ai_qa:
        for i, c_obj in enumerate(chunks_with_meta):
            preview_items.append({
                "id": str(uuid.uuid4()),
                "type": "chunk",
                "question": f"Conteúdo Extraído (Parte {i+1} - Pág {c_obj['metadata']['page']})", 
                "answer": c_obj["text"],
                "category": f"Documento (Pág {c_obj['metadata']['page']})",
                "metadata": c_obj["metadata"],
                "selected": True
            })
        
    from config_store import MODEL_INFO, USD_TO_BRL

    # Stats tracking
    total_usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cost_usd": 0.0,
        "models": set()
    }

    def update_usage(usage_dict):
        if not usage_dict: return
        model_real = usage_dict.get("model")
        model_family = usage_dict.get("family", model_real)
        
        total_usage["input_tokens"] += usage_dict.get("input_tokens", 0)
        total_usage["output_tokens"] += usage_dict.get("output_tokens", 0)
        
        # Display as "Family (Real ID)" if different
        display_name = f"{model_family} ({model_real})" if model_family != model_real else model_real
        total_usage["models"].add(display_name)
        
        # Calculate cost using family for pricing lookup
        pricing = MODEL_INFO.get(model_family, MODEL_INFO.get("gpt-4o-mini", list(MODEL_INFO.values())[0]))
        cost = (usage_dict.get("input_tokens", 0) * pricing.get("input", 0)) + \
               (usage_dict.get("output_tokens", 0) * pricing.get("output", 0))
        total_usage["cost_usd"] += cost

    # 2. AI Generation
    if use_ai_qa:
        if mode == "global":
            qas, usage = await generate_global_qa(full_text, global_qa_count, user_suggestions, extraction_type, model)
            update_usage(usage)
            for qa in qas:
                # Use AI-suggested source if available, fallback to smart snippet search
                ai_source = qa.get('trecho_original')
                if not ai_source or len(ai_source) < 10:
                    ai_source = find_relevant_snippet(qa.get('resposta', ''), full_text)
                
                ai_page = qa.get('pagina')
                
                preview_items.append({
                    "id": str(uuid.uuid4()),
                    "type": "ai_qa",
                    "question": qa.get('pergunta', 'Pergunta Sugerida'),
                    "answer": qa.get('resposta', 'Resposta Sugerida'),
                    "category": qa.get('categoria', 'IA - Análise Global'),
                    "metadata_val": qa.get('metadado', ""),
                    "source_text": ai_source,
                    "metadata": {"type": "global", "page": ai_page},
                    "selected": True
                })
        elif mode == "sections":
            sections = detect_sections(pages_data)
            sem_sections = asyncio.Semaphore(3)

            async def process_section(section):
                async with sem_sections:
                    text = section["text"]
                    if use_vision:
                        visual = await extract_visual_content_from_section(tmp_path, section)
                        if visual:
                            text = text + "\n\n" + visual
                    qas, usage = await generate_global_qa(
                        text, qa_per_section, user_suggestions, extraction_type, model
                    )
                    return qas, usage, section["title"], section.get("start_page")

            section_results = await asyncio.gather(*[process_section(s) for s in sections])

            for qas, usage, section_title, start_page in section_results:
                update_usage(usage)
                for qa in qas:
                    ai_source = qa.get('trecho_original') or ""
                    if not ai_source or len(ai_source) < 10:
                        ai_source = find_relevant_snippet(qa.get('resposta', ''), full_text)
                    preview_items.append({
                        "id": str(uuid.uuid4()),
                        "type": "ai_qa",
                        "question": qa.get('pergunta', 'Pergunta'),
                        "answer": qa.get('resposta', 'Resposta'),
                        "category": section_title,
                        "metadata_val": qa.get('metadado', ""),
                        "source_text": ai_source,
                        "metadata": {"type": "section", "page": qa.get('pagina') or start_page},
                        "selected": True
                    })

        else:
            # Chunk Analysis (Legacy Smart Mode)
            # Limit to processing first 5 chunks for preview speed
            target_chunks = chunks_with_meta[:5]
            sem = asyncio.Semaphore(3)
            
            async def safe_gen(c_obj, idx):
                async with sem:
                    # Pass the text to generate QA
                    qas, usage = await generate_qa_from_text(c_obj["text"], qa_count_per_chunk, model)
                    return qas, usage, c_obj["metadata"], c_obj["text"]
                    
            results = await asyncio.gather(*[safe_gen(ch, i) for i, ch in enumerate(target_chunks)])
            
            for qas, usage, meta, source_text in results:
                update_usage(usage)
                for qa in qas:
                    ai_source = qa.get('trecho_original')
                    ai_page = qa.get('pagina') or meta.get('page')
                    
                    preview_items.append({
                        "id": str(uuid.uuid4()),
                        "type": "ai_qa",
                        "question": qa.get('pergunta', 'Pergunta Sugerida'),
                        "answer": qa.get('resposta', 'Resposta Sugerida'),
                        "category": qa.get('categoria', f"IA (Pág {ai_page})"),
                        "metadata_val": qa.get('metadado', ""),
                        "source_text": ai_source if ai_source else source_text,
                        "metadata": {**meta, "page": ai_page},
                        "selected": True
                    })

    await _log_extraction_cost(db, kb_id, total_usage, "Importação de PDF")

    # Limpeza final do arquivo temporário
    if os.path.exists(tmp_path):
        os.unlink(tmp_path)

    return {
        "preview": preview_items, 
        "total_text_length": len(full_text),
        "total_chunks_generated": len(chunks_with_meta),
        "ai_generated_count": len([i for i in preview_items if i['type'] == 'ai_qa']),
        "usage": {
            "input_tokens": total_usage["input_tokens"],
            "output_tokens": total_usage["output_tokens"],
            "total_tokens": total_usage["input_tokens"] + total_usage["output_tokens"],
            "cost_usd": round(total_usage["cost_usd"], 6),
            "cost_brl": round(total_usage["cost_usd"] * USD_TO_BRL, 4),
            "models": list(total_usage["models"])
        }
    }

class BatchImportItem(BaseModel):
    question: str
    answer: str
    category: str | None = "Geral"
    source_text: str | None = None
    metadata_val: str | None = None
    metadata: dict | None = None

class BatchImportRequest(BaseModel):
    items: List[BatchImportItem]

@router.post("/knowledge-bases/{kb_id}/batch-import")
async def batch_import_items(
    kb_id: int,
    data: BatchImportRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        print(f"DEBUG: batch_import_items called for KB {kb_id} with {len(data.items)} items")
        count = 0
        
        # 1. Generate Embeddings first (Parallel is safe here since no DB access)
        sem = asyncio.Semaphore(5)
        
        async def enrich_item(item):
            text_to_embed = f"{item.question}\n{item.answer}"
            async with sem:
                emb, _ = await get_embedding(text_to_embed)
            return item, emb

        enriched_items = await asyncio.gather(*[enrich_item(item) for item in data.items])
        
        # 2. Write to DB Sequentially (Safe for Session)
        for item, emb in enriched_items:
            # Check existance first (Upsert Logic)
            existing = await db.execute(select(KnowledgeItemModel).where(
                KnowledgeItemModel.knowledge_base_id == kb_id,
                KnowledgeItemModel.question == item.question
            ))
            existing_item = existing.scalars().first()
            
            meta_dict = item.metadata or {}
            if item.source_text:
                meta_dict["source_text"] = item.source_text
                
            meta_json = json.dumps(meta_dict) if meta_dict else None
            
            if existing_item:
                existing_item.answer = item.answer
                existing_item.metadata_val = item.metadata_val
                existing_item.category = item.category
                existing_item.embedding = emb
                existing_item.source_metadata = meta_json
            else:
                new_item = KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question=item.question,
                    answer=item.answer,
                    metadata_val=item.metadata_val,
                    category=item.category,
                    embedding=emb,
                    source_metadata=meta_json
                )
                print(f"DEBUG: Adding new item: {new_item.question}")
                db.add(new_item)
            count += 1
        
        await db.commit()
        return {"message": f"{count} itens processados e vetorizados com sucesso."}
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in batch_import_items: {error_msg}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/knowledge-bases/{kb_id}/preview-text-import")
async def preview_text_import(
    kb_id: int,
    text: str = Form(...),
    use_ai_qa: bool = Form(True),
    user_suggestions: str | None = Form(None),
    global_qa_count: int = Form(10),
    extraction_type: str = Form("suggestions"),
    chunk_size: int = Form(1000),
    model: str = Form("gpt-4o-mini"),
    db: AsyncSession = Depends(get_db)
):
    print(f"DEBUG: preview_text_import called. KB={kb_id}, Type={extraction_type}, Count={global_qa_count}")
    
    if not text.strip():
        return {"error": "O texto colado está vazio."}
        
    # 0. Fetch KB Labels
    kb_res = await db.execute(select(KnowledgeBaseModel).where(KnowledgeBaseModel.id == kb_id))
    kb = kb_res.scalars().first()
    q_label = kb.question_label if kb and kb.question_label else "Pergunta"
    a_label = kb.answer_label if kb and kb.answer_label else "Resposta"
    m_label = kb.metadata_label if kb and kb.metadata_label else "Metadado"

    preview_items = []
    is_structured_json = False
    
    # 1. Try to parse as Structured JSON
    try:
        data = json.loads(text)
        if isinstance(data, list):
            for entry in data:
                if isinstance(entry, dict) and "context" in entry and isinstance(entry["context"], list):
                    print(f"DEBUG: Found structured JSON entry with context")
                    is_structured_json = True
                    for item in entry["context"]:
                        print(f"DEBUG: Parsing item: {item}")
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
        print(f"DEBUG: Not a structured JSON ({e})")

    if is_structured_json:
        return {
            "preview": preview_items,
            "is_structured_json": True,
            "q_label": q_label,
            "a_label": a_label,
            "m_label": m_label,
            "total_items": len(preview_items)
        }

    # 2. Regular AI/Chunk Flow
    from config_store import MODEL_INFO, USD_TO_BRL
    total_usage = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "models": set()}

    def update_usage(usage_dict):
        if not usage_dict: return
        model = usage_dict.get("model")
        total_usage["input_tokens"] += usage_dict.get("input_tokens", 0)
        total_usage["output_tokens"] += usage_dict.get("output_tokens", 0)
        total_usage["models"].add(model)
        pricing = MODEL_INFO.get(model, MODEL_INFO.get("gpt-4o-mini", list(MODEL_INFO.values())[0]))
        cost = (usage_dict.get("input_tokens", 0) * pricing["input"]) + \
               (usage_dict.get("output_tokens", 0) * pricing["output"])
        total_usage["cost_usd"] += cost

    if use_ai_qa:
        qas, usage = await generate_global_qa(text, global_qa_count, user_suggestions, extraction_type, model)
        update_usage(usage)
        for qa in qas:
            preview_items.append({
                "id": str(uuid.uuid4()),
                "type": "ai_qa",
                "metadata_val": qa.get('metadado', ""),
                "question": qa.get('pergunta', 'Pergunta Sugerida'),
                "answer": qa.get('resposta', 'Resposta Sugerida'),
                "category": qa.get('categoria', 'Texto Colado'),
                "selected": True
            })
    else:
        chunks = chunk_text(text, chunk_size)
        for i, c in enumerate(chunks[:20]):
            preview_items.append({
                "id": str(uuid.uuid4()),
                "type": "chunk",
                "metadata_val": "",
                "question": f"{q_label} (Parte {i+1})", 
                "answer": c["text"],
                "category": "Texto Colado",
                "selected": True
            })

    if use_ai_qa:
        await _log_extraction_cost(db, kb_id, total_usage, "Importação de Texto")

    return {
        "preview": preview_items, 
        "total_text_length": len(text),
        "q_label": q_label,
        "a_label": a_label,
        "m_label": m_label,
        "usage": {
            "input_tokens": total_usage["input_tokens"],
            "output_tokens": total_usage["output_tokens"],
            "total_tokens": total_usage["input_tokens"] + total_usage["output_tokens"],
            "cost_usd": round(total_usage["cost_usd"], 6),
            "cost_brl": round(total_usage["cost_usd"] * USD_TO_BRL, 4),
            "models": list(total_usage["models"])
        }
    }
