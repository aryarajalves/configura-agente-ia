from celery_app import app
import asyncio
from datetime import datetime, timedelta, timezone
import os
import logging
from sqlalchemy import text
from database import async_session, engine
from models import BackgroundProcessLog, KnowledgeBaseModel, KnowledgeItemModel
from transcription_service import transcribe_video
from smart_importer import chunk_text, generate_global_qa
from rag_service import get_batch_embeddings

logger = logging.getLogger(__name__)

async def _update_log_status(log_id: int, status: str, progress: int, error_message: str = None, details_update: dict = None):
    async with async_session() as db:
        log = await db.get(BackgroundProcessLog, log_id)
        if log:
            log.status = status
            log.progress = progress
            if error_message:
                log.error_message = error_message
            if details_update:
                current_details = log.details or {}
                current_details.update(details_update)
                log.details = current_details
            await db.commit()

async def _delete_old_logs(days=30):
    async with async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        # Using string literal for the query to be generic, or SQLAlchemy core
        query = text("DELETE FROM background_process_logs WHERE created_at < :cutoff")
        result = await db.execute(query, {"cutoff": cutoff_date})
        await db.commit()
        return result.rowcount

@app.task(bind=True)
def process_video_task(self, log_id: int, payload: dict):
    """
    Task para processamento de vídeo e geração de bases de conhecimento usando AssemblyAI e IA local.
    """
    async def _async_logic():
        try:
            video_path = payload.get("video_path")
            options = payload.get("options", {})
            md_dict = payload.get("metadata", {})
            metadata_str = " | ".join(f"{k}: {v}" for k, v in md_dict.items()) if md_dict else "Processamento Background"

            await _update_log_status(log_id, "PROCESSANDO", 5, details_update={"task_id": self.request.id})
            
            # 1. Transcrição via AssemblyAI (Síncrono/Bloqueante, rodando em thread para não travar o loop)
            self.update_state(state='PROGRESS', meta={'progress': 10})
            trans_config = {}
            trans_result = await asyncio.to_thread(transcribe_video, video_path, trans_config)
            
            text_transcribed = trans_result["text"]
            duration = trans_result.get("duration", 0)
            
            await _update_log_status(log_id, "PROCESSANDO", 40, details_update={"transcription": "Concluída"})

            # 2. RAG Processamento Assíncrono
            async def _process_rag():
                async with async_session() as db:
                    # Criar a KB Nova
                    kb = KnowledgeBaseModel(
                        name=f"Base de Vídeo ({datetime.now().strftime('%d/%m/%Y %H:%M')})",
                        description=f"Origem: {video_path}"
                    )
                    db.add(kb)
                    await db.commit()
                    await db.refresh(kb)
                    kb_id = kb.id
                    
                    items_to_add = []
                    
                    # Q&A Extração
                    if options.get("extrair_perguntas"):
                        num_q = max(3, min(15, len(text_transcribed) // 500))
                        qa_list, _ = await generate_global_qa(text_transcribed, total_questions=num_q)
                        if qa_list:
                            for item in qa_list:
                                items_to_add.append(KnowledgeItemModel(
                                    knowledge_base_id=kb_id,
                                    question=item.get("pergunta", "Questão extraída"),
                                    answer=item.get("resposta", ""),
                                    metadata_val=f"{metadata_str} | Source: Q&A",
                                    category="Transcrição"
                                ))

                    # Resumo
                    if options.get("gerar_resumo"):
                        try:
                            from agent import get_openai_client
                            client = get_openai_client()
                            if client:
                                response = await client.chat.completions.create(
                                    model="gpt-4o-mini",
                                    messages=[
                                        {"role": "system", "content": "Você é um assistente especialista em síntese de informações. Resuma o texto fornecido em pontos principais (bullet points) de forma executiva e clara. Use Português do Brasil."},
                                        {"role": "user", "content": f"Texto para resumir:\n\n{text_transcribed}"}
                                    ],
                                    temperature=0.5
                                )
                                summary_text = response.choices[0].message.content
                                items_to_add.append(KnowledgeItemModel(
                                    knowledge_base_id=kb_id,
                                    question=f"Resumo da Transcrição - {metadata_str}",
                                    answer=summary_text,
                                    metadata_val=f"{metadata_str} | Source: Resumo",
                                    category="Resumo"
                                ))
                        except Exception as e:
                            logger.error(f"Erro no resumo process_video_task: {e}")

                    # Chunks Extration
                    if options.get("extrair_chunks"):
                        chunks = chunk_text(text_transcribed, chunk_size=1200, overlap=150)
                        for i, chunk in enumerate(chunks):
                            items_to_add.append(KnowledgeItemModel(
                                knowledge_base_id=kb_id,
                                question=f"Trecho de Conhecimento {i+1}",
                                answer=chunk["text"],
                                metadata_val=f"{metadata_str} | Source: Chunk",
                                category="Chunking"
                            ))

                    # Fallback Se Nada Foi Marcado
                    if not items_to_add:
                        items_to_add.append(KnowledgeItemModel(
                            knowledge_base_id=kb_id,
                            question="Conteúdo Integral da Transcrição",
                            answer=text_transcribed,
                            metadata_val=metadata_str,
                            category="Transcrição"
                        ))

                    # É CRUCIAL adicionar os itens à sessão antes de continuar!
                    db.add_all(items_to_add)
                    await db.commit() # Salva items preliminarmente sem os embeddings
                    
                    await _update_log_status(log_id, "PROCESSANDO", 60)
                    
                    # Gerar Embeddings
                    batch_size = 50
                    total_items = len(items_to_add)
                    for i in range(0, total_items, batch_size):
                        batch = items_to_add[i:i+batch_size]
                        batch_texts = [f"{item.metadata_val} | {item.question} | {item.answer}" for item in batch]
                        embeddings, _ = await get_batch_embeddings(batch_texts)
                        for j, item in enumerate(batch):
                            if embeddings and j < len(embeddings):
                                item.embedding = embeddings[j]
                        
                        current_prog = 60 + int(((i + len(batch)) / total_items) * 35) # scale to 95 max
                        await _update_log_status(log_id, "PROCESSANDO", current_prog)
                    
                    await db.commit()
                    return kb_id, total_items

            # Call RAG Async logic
            kb_id, total_count = await _process_rag()
            
            self.update_state(state='SUCCESS', meta={'progress': 100})
            await _update_log_status(
                log_id, "CONCLUIDO", 100, 
                details_update={
                    "result": f"Processamento concluído com sucesso. Base de Conhecimento {kb_id} criada.",
                    "duration_audio": duration,
                    "items_generated": total_count,
                    "kb_id": kb_id
                }
            )
            
        except Exception as e:
            logger.error(f"Erro no process_video_task {log_id}: {str(e)}")
            await _update_log_status(log_id, "ERRO", 0, error_message=str(e))
        finally:
            # Garante que o motor seja limpo entre execuções de loops diferentes (Asyncio Run em Celery)
            await engine.dispose()
            # Garante remoção do vídeo temporário
            if video_path and os.path.exists(video_path):
                try: os.remove(video_path)
                except: pass

    # Executa toda a lógica em um único loop de evento
    asyncio.run(_async_logic())


@app.task(bind=True)
def process_kb_media_task(self, log_id: int, kb_id: int, payload: dict):
    """
    Task para processamento de arquivos (mídia ou txt) em background diretos para uma Base de Conhecimento específica.
    """
    async def _async_logic():
        try:
            file_path = payload.get("file_path")
            is_media = payload.get("is_media", True)
            options = payload.get("options", {})
            metadata_val = payload.get("metadata_val", "")
            if isinstance(metadata_val, (dict, list)):
                import json
                metadata_val = json.dumps(metadata_val)
            else:
                metadata_val = str(metadata_val) if metadata_val else ""

            await _update_log_status(log_id, "PROCESSANDO", 5, details_update={"task_id": self.request.id})
            
            text_transcribed = ""
            duration = 0
            
            try:
                if is_media:
                    # 1. Transcrição via AssemblyAI (Síncrono/Bloqueante, rodando em thread)
                    self.update_state(state='PROGRESS', meta={'progress': 10})
                    await _update_log_status(log_id, "PROCESSANDO", 10, details_update={"step": "Transcrevendo arquivo"})
                    
                    trans_result = await asyncio.to_thread(transcribe_video, file_path, {})
                    text_transcribed = trans_result.get("text", "")
                    duration = trans_result.get("duration", 0)
                    
                    await _update_log_status(log_id, "PROCESSANDO", 45, details_update={"step": "Transcrição Concluída"})
                else:
                    # Leitura direta do txt
                    await _update_log_status(log_id, "PROCESSANDO", 10, details_update={"step": "Lendo arquivo de texto"})
                    with open(file_path, "r", encoding="utf-8") as f:
                        text_transcribed = f.read()
                    await _update_log_status(log_id, "PROCESSANDO", 40, details_update={"read": "Concluída"})
            finally:
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except:
                        pass

            if not text_transcribed.strip():
                await _update_log_status(log_id, "ERRO", 0, error_message="Nenhum texto detectado no arquivo.")
                return

            # 2. RAG Processamento Assíncrono para a KB específica
            async def _process_kb_rag():
                async with async_session() as db:
                    kb = await db.get(KnowledgeBaseModel, kb_id)
                    if not kb:
                        raise Exception("Base de conhecimento não encontrada.")
                    
                    items_to_add = []
                    
                    # Q&A Extração
                    if options.get("extractQA"):
                        num_q = max(3, min(15, len(text_transcribed) // 500))
                        qa_list, _ = await generate_global_qa(text_transcribed, total_questions=num_q)
                        if qa_list:
                            for item in qa_list:
                                items_to_add.append(KnowledgeItemModel(
                                    knowledge_base_id=kb_id,
                                    question=item.get("pergunta", "Questão extraída"),
                                    answer=item.get("resposta", ""),
                                    metadata_val=f"{metadata_val} | Source: Q&A",
                                    category="Transcrição API"
                                ))
                        await _update_log_status(log_id, "PROCESSANDO", 50, details_update={"step": "Q&A Extraído"})

                    # Resumo
                    if options.get("generateSummary"):
                        try:
                            from agent import get_openai_client
                            client = get_openai_client()
                            if client:
                                response = await client.chat.completions.create(
                                    model="gpt-4o-mini",
                                    messages=[
                                        {"role": "system", "content": "Você é um assistente especialista em síntese de informações. Resuma o texto fornecido em pontos principais (bullet points) de forma executiva e clara. Use Português do Brasil."},
                                        {"role": "user", "content": f"Texto para resumir:\n\n{text_transcribed}"}
                                    ],
                                    temperature=0.5
                                )
                                summary_text = response.choices[0].message.content
                                items_to_add.append(KnowledgeItemModel(
                                    knowledge_base_id=kb_id,
                                    question=f"Resumo do Conteúdo - {metadata_val}",
                                    answer=summary_text,
                                    metadata_val=f"{metadata_val} | Source: Resumo",
                                    category="Resumo"
                                ))
                        except Exception as e:
                            logger.error(f"Erro no resumo process_kb_media_task: {e}")
                        
                        await _update_log_status(log_id, "PROCESSANDO", 55, details_update={"step": "Resumo Gerado"})

                    # Chunks Extration
                    if options.get("extractChunks"):
                        c_size = options.get("chunkSize", 1200)
                        c_overlap = options.get("chunkOverlap", 150)
                        chunks = chunk_text(text_transcribed, chunk_size=c_size, overlap=c_overlap)
                        for i, chunk in enumerate(chunks):
                            items_to_add.append(KnowledgeItemModel(
                                knowledge_base_id=kb_id,
                                question=f"Trecho de Conhecimento {i+1} - {metadata_val}",
                                answer=chunk["text"],
                                metadata_val=f"{metadata_val} | Source: Chunk",
                                category="Chunking"
                            ))
                        await _update_log_status(log_id, "PROCESSANDO", 60, details_update={"step": "Chunks Gerados"})

                    # Fallback Se Nada Foi Marcado
                    if not items_to_add:
                        items_to_add.append(KnowledgeItemModel(
                            knowledge_base_id=kb_id,
                            question="Conteúdo Original",
                            answer=text_transcribed,
                            metadata_val=metadata_val,
                            category="Upload Bruto"
                        ))

                    db.add_all(items_to_add)
                    await db.commit() # Salva items preliminarmente sem os embeddings
                    
                    await _update_log_status(log_id, "PROCESSANDO", 60)
                    
                    # Gerar Embeddings
                    batch_size = 50
                    total_items = len(items_to_add)
                    for i in range(0, total_items, batch_size):
                        batch = items_to_add[i:i+batch_size]
                        batch_texts = [f"{item.metadata_val} | {item.question} | {item.answer}" for item in batch]
                        embeddings, _ = await get_batch_embeddings(batch_texts)
                        for j, item in enumerate(batch):
                            if embeddings and j < len(embeddings):
                                item.embedding = embeddings[j]
                        
                        current_prog = 60 + int(((i + len(batch)) / total_items) * 35) # scale to 95 max
                        await _update_log_status(log_id, "PROCESSANDO", current_prog)
                    
                    await db.commit()
                    return total_items

            # Call RAG Async loop
            total_count = await _process_kb_rag()
            
            self.update_state(state='SUCCESS', meta={'progress': 100})
            await _update_log_status(
                log_id, "CONCLUIDO", 100, 
                details_update={
                    "result": f"Processamento concluído. {total_count} itens adicionados.",
                    "duration_audio": duration,
                    "items_generated": total_count,
                    "kb_id": kb_id
                }
            )
            
        except Exception as e:
            logger.error(f"Erro CRÍTICO no process_kb_media_task {log_id}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            await _update_log_status(log_id, "ERRO", 0, error_message=str(e))
        finally:
            # Garante que o motor seja limpo entre execuções de loops diferentes (Asyncio Run em Celery)
            await engine.dispose()
            # Garante que o arquivo seja removido mesmo em erro fatal se ainda existir
            if file_path and os.path.exists(file_path):
                try: os.remove(file_path)
                except: pass

    asyncio.run(_async_logic())



@app.task
def delete_old_process_logs_task():
    """
    Tarefa recorrente agendada (Cron) para deletar os logs mais antigos do que 1 mês automaticamente.
    """
    try:
        deleted_count = asyncio.run(_delete_old_logs(days=30))
        logger.info(f"Limpeza de logs finalizada. {deleted_count} logs antigos removidos.")
    except Exception as e:
        logger.error(f"Erro ao limpar logs antigos: {str(e)}")
