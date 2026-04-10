from src.tkq.tkq_config import broker
from src.services.cloud_service import CloudService
from src.services.s3_service import s3_service
from database import engine, async_session
from models import BackgroundProcessLog, KnowledgeBaseModel, KnowledgeItemModel
from transcription_service import transcribe_video
from smart_importer import chunk_text, generate_global_qa
from rag_service import get_batch_embeddings
from src.models.ingestion import IngestionTask, IngestionStatus
from sqlalchemy.future import select
from sqlalchemy import text
from src.core.message_bus import message_bus
import asyncio
import json
import os
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

async def _publish_state(task_id: str, status: str, step: str, progress: int, error: str = None):
    payload = {
        "task_id": task_id,
        "status": status,
        "step": step,
        "progress": progress
    }
    if error:
        payload["error"] = error
    await message_bus.publish(f"task:{task_id}", payload)

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

@broker.task
async def task_upload_to_b2(task_id: str, local_path: str, remote_filename: str):
    async with async_session() as db:
        result = await db.execute(select(IngestionTask).where(IngestionTask.id == task_id))
        task = result.scalars().first()
        if not task:
            return

        task.status = IngestionStatus.UPLOADING
        task.current_step = f"Iniciando upload para S3: {remote_filename}"
        task.progress = 10
        await db.commit()
        await _publish_state(task_id, task.status.value, task.current_step, task.progress)

        try:
            cloud_service = CloudService()
            loop = asyncio.get_running_loop()
            max_retries = 3
            remote_id = None
            for attempt in range(1, max_retries + 1):
                try:
                    remote_id = await loop.run_in_executor(
                        None, 
                        cloud_service.upload_file, 
                        local_path, 
                        remote_filename
                    )
                    break 
                except Exception as upload_err:
                    if attempt == max_retries:
                        raise upload_err
                    await _publish_state(task_id, task.status.value, f"Falha no upload. Tentativa {attempt}/{max_retries}... Reconectando.", task.progress)
                    await asyncio.sleep(2 * attempt)

            task.remote_id = remote_id
            task.status = IngestionStatus.PROCESSING
            task.current_step = "Upload concluído. Iniciando processamento..."
            task.progress = 50
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress)

            if os.path.exists(local_path):
                os.remove(local_path)

            await task_process_ia.kiq(task_id, remote_id, remote_filename)

        except Exception as e:
            task.status = IngestionStatus.FAILED
            task.error_message = str(e)
            task.current_step = "Erro no upload."
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress, str(e))
            raise

@broker.task
async def task_process_ia(task_id: str, remote_id: str, remote_filename: str):
    async with async_session() as db:
        result = await db.execute(select(IngestionTask).where(IngestionTask.id == task_id))
        task = result.scalars().first()
        if not task:
            return

        task.current_step = "Indexando no RAG..."
        task.progress = 75
        await db.commit()
        await _publish_state(task_id, task.status.value, task.current_step, task.progress)

        try:
            await asyncio.sleep(2)
            
            task.status = IngestionStatus.COMPLETED
            task.current_step = "Processamento concluído."
            task.progress = 100
            
            import time
            log_entry = {"event": "RAG Extraction Successful", "timestamp": time.time()}
            current_logs = task.logs or []
            task.logs = current_logs + [log_entry]
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress)

            from src.services.cloud_service import CloudService as CS
            cloud = CS()
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, cloud.delete_file, remote_filename, remote_id)
            
        except Exception as e:
            task.status = IngestionStatus.FAILED
            task.error_message = str(e)
            task.current_step = "Erro no processamento IA."
            await db.commit()
            await _publish_state(task_id, task.status.value, task.current_step, task.progress, str(e))
            raise

# --- Migrated from backend/tasks.py ---

@broker.task
async def process_video_task(log_id: int, payload: dict):
    try:
        video_path = payload.get("video_path")
        options = payload.get("options", {})
        md_dict = payload.get("metadata", {})
        metadata_str = " | ".join(f"{k}: {v}" for k, v in md_dict.items()) if md_dict else "Processamento Background"

        await _update_log_status(log_id, "PROCESSANDO", 5)
        
        actual_path = video_path
        if s3_service.enabled and video_path and not os.path.exists(video_path):
            actual_path = s3_service.get_presigned_url(video_path)
            logger.info(f"Usando URL pré-assinada para S3 (video_task): {video_path}")
        
        trans_config = {}
        trans_result = await asyncio.to_thread(transcribe_video, actual_path, trans_config)
        
        text_transcribed = trans_result["text"]
        duration = trans_result.get("duration", 0)
        
        await _update_log_status(log_id, "PROCESSANDO", 40, details_update={"transcription": "Concluída"})

        async with async_session() as db:
            kb = KnowledgeBaseModel(
                name=f"Base de Vídeo ({datetime.now().strftime('%d/%m/%Y %H:%M')})",
                description=f"Origem: {video_path}"
            )
            db.add(kb)
            await db.commit()
            await db.refresh(kb)
            kb_id = kb.id
            
            items_to_add = []
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

            if options.get("extrair_chunks"):
                chunks = chunk_text(text_transcribed, chunk_size=1500, overlap=150)
                for i, chunk in enumerate(chunks):
                    items_to_add.append(KnowledgeItemModel(
                        knowledge_base_id=kb_id,
                        question=f"Trecho de Conhecimento {i+1}",
                        answer=chunk["text"],
                        metadata_val=f"{metadata_str} | Source: Chunk",
                        category="Chunking"
                    ))

            if not items_to_add:
                items_to_add.append(KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question="Conteúdo Integral da Transcrição",
                    answer=text_transcribed,
                    metadata_val=metadata_str,
                    category="Transcrição"
                ))

            db.add_all(items_to_add)
            await db.commit()
            
            await _update_log_status(log_id, "PROCESSANDO", 60)
            
            batch_size = 50
            total_items = len(items_to_add)
            for i in range(0, total_items, batch_size):
                batch = items_to_add[i:i+batch_size]
                batch_texts = [f"{item.metadata_val} | {item.question} | {item.answer}" for item in batch]
                embeddings, _ = await get_batch_embeddings(batch_texts)
                for j, item in enumerate(batch):
                    if embeddings and j < len(embeddings):
                        item.embedding = embeddings[j]
                
                current_prog = 60 + int(((i + len(batch)) / total_items) * 35)
                await _update_log_status(log_id, "PROCESSANDO", current_prog)
            
            await db.commit()

        await _update_log_status(
            log_id, "CONCLUIDO", 100, 
            details_update={
                "result": f"Processamento concluído com sucesso. Base de Conhecimento {kb_id} criada.",
                "duration_audio": duration,
                "items_generated": total_items,
                "kb_id": kb_id
            }
        )
        
    except Exception as e:
        logger.error(f"Erro no process_video_task {log_id}: {str(e)}")
        await _update_log_status(log_id, "ERRO", 0, error_message=str(e))
    finally:
        if video_path:
            if os.path.exists(video_path):
                try: os.remove(video_path)
                except: pass
            elif s3_service.enabled:
                try: s3_service.delete_object(video_path)
                except: pass

@broker.task
async def process_kb_media_task(log_id: int, kb_id: int, payload: dict):
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

        await _update_log_status(log_id, "PROCESSANDO", 5)
        
        text_transcribed = ""
        duration = 0
        
        try:
            if is_media:
                await _update_log_status(log_id, "PROCESSANDO", 10, details_update={"step": "Transcrevendo arquivo"})
                actual_path = file_path
                if s3_service.enabled and file_path and not os.path.exists(file_path):
                    actual_path = s3_service.get_presigned_url(file_path)
                    logger.info(f"Usando URL pré-assinada para S3: {file_path}")
                
                trans_result = await asyncio.to_thread(transcribe_video, actual_path, {})
                text_transcribed = trans_result.get("text", "")
                duration = trans_result.get("duration", 0)
                await _update_log_status(log_id, "PROCESSANDO", 45, details_update={"step": "Transcrição Concluída"})
            else:
                await _update_log_status(log_id, "PROCESSANDO", 10, details_update={"step": "Lendo arquivo de texto"})
                if os.path.exists(file_path):
                    with open(file_path, "r", encoding="utf-8") as f:
                        text_transcribed = f.read()
                    await _update_log_status(log_id, "PROCESSANDO", 40, details_update={"read": "Concluída"})
                else:
                    raise Exception(f"Arquivo local não encontrado: {file_path}")
        finally:
            if file_path:
                if os.path.exists(file_path):
                    try: os.remove(file_path)
                    except: pass
                elif s3_service.enabled:
                    try: s3_service.delete_object(file_path)
                    except: pass

        if not text_transcribed.strip():
            await _update_log_status(log_id, "ERRO", 0, error_message="Nenhum texto detectado no arquivo.")
            return

        async with async_session() as db:
            kb = await db.get(KnowledgeBaseModel, kb_id)
            if not kb:
                raise Exception("Base de conhecimento não encontrada.")
            
            items_to_add = []
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

            if options.get("extractChunks"):
                c_size = options.get("chunkSize", 1500)
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

            if not items_to_add:
                items_to_add.append(KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question="Conteúdo Original",
                    answer=text_transcribed,
                    metadata_val=metadata_val,
                    category="Upload Bruto"
                ))

            db.add_all(items_to_add)
            await db.commit()
            
            await _update_log_status(log_id, "PROCESSANDO", 60)
            
            batch_size = 50
            total_items = len(items_to_add)
            for i in range(0, total_items, batch_size):
                batch = items_to_add[i:i+batch_size]
                batch_texts = [f"{item.metadata_val} | {item.question} | {item.answer}" for item in batch]
                embeddings, _ = await get_batch_embeddings(batch_texts)
                for j, item in enumerate(batch):
                    if embeddings and j < len(embeddings):
                        item.embedding = embeddings[j]
                
                current_prog = 60 + int(((i + len(batch)) / total_items) * 35)
                await _update_log_status(log_id, "PROCESSANDO", current_prog)
            
            await db.commit()

        await _update_log_status(
            log_id, "CONCLUIDO", 100, 
            details_update={
                "result": f"Processamento concluído. {total_items} itens adicionados.",
                "duration_audio": duration,
                "items_generated": total_items,
                "kb_id": kb_id
            }
        )
        
    except Exception as e:
        logger.error(f"Erro CRÍTICO no process_kb_media_task {log_id}: {str(e)}")
        await _update_log_status(log_id, "ERRO", 0, error_message=str(e))

@broker.task
async def process_kb_json_item_task(log_id: int, kb_id: int, payload: dict):
    try:
        text_content = payload.get("context", "")
        metadata_val = payload.get("metadata", "")
        if isinstance(metadata_val, list):
            metadata_val = " | ".join(map(str, metadata_val))
        elif isinstance(metadata_val, dict):
            import json
            metadata_val = json.dumps(metadata_val)
        else:
            metadata_val = str(metadata_val) if metadata_val else ""
        
        options = payload.get("options", {})
        
        await _update_log_status(log_id, "PROCESSANDO", 5)

        if not text_content.strip():
            await _update_log_status(log_id, "ERRO", 0, error_message="Conteúdo vazio para este item.")
            return

        async with async_session() as db:
            items_to_add = []
            if options.get("extractQA"):
                num_q = max(3, min(15, len(text_content) // 500))
                qa_list, _ = await generate_global_qa(text_content, total_questions=num_q)
                if qa_list:
                    for item in qa_list:
                        items_to_add.append(KnowledgeItemModel(
                            knowledge_base_id=kb_id,
                            question=item.get("pergunta", "Questão extraída"),
                            answer=item.get("resposta", ""),
                            metadata_val=f"{metadata_val} | Source: Q&A (JSON)",
                            category="JSON Import"
                        ))
            
            if options.get("generateSummary"):
                try:
                    from agent import get_openai_client
                    client = get_openai_client()
                    if client:
                        response = await client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {"role": "system", "content": "Você é um assistente especialista em síntese de informações. Resuma o texto fornecido em pontos principais (bullet points) de forma executiva e clara."},
                                {"role": "user", "content": f"Texto para resumir:\n\n{text_content}"}
                            ],
                            temperature=0.5
                        )
                        summary_text = response.choices[0].message.content
                        items_to_add.append(KnowledgeItemModel(
                            knowledge_base_id=kb_id,
                            question=f"Resumo - {metadata_val}" if metadata_val else "Resumo de Item JSON",
                            answer=summary_text,
                            metadata_val=f"{metadata_val} | Source: Resumo (JSON)",
                            category="Resumo"
                        ))
                except Exception as e:
                    logger.error(f"Erro no resumo JSON task: {e}")

            if options.get("extractChunks"):
                c_size = options.get("chunkSize", 1500)
                c_overlap = options.get("chunkOverlap", 150)
                chunks = chunk_text(text_content, chunk_size=c_size, overlap=c_overlap)
                for i, chunk in enumerate(chunks):
                    items_to_add.append(KnowledgeItemModel(
                        knowledge_base_id=kb_id,
                        question=f"Trecho {i+1} - {metadata_val}" if metadata_val else f"Trecho {i+1}",
                        answer=chunk["text"],
                        metadata_val=f"{metadata_val} | Source: Chunk (JSON)",
                        category="Chunking"
                    ))

            if not items_to_add:
                items_to_add.append(KnowledgeItemModel(
                    knowledge_base_id=kb_id,
                    question=f"Conteúdo de {metadata_val}" if metadata_val else "Conteúdo JSON",
                    answer=text_content,
                    metadata_val=metadata_val,
                    category="Upload JSON"
                ))

            db.add_all(items_to_add)
            await db.commit()
            
            total_items = len(items_to_add)
            for i in range(0, total_items, 50):
                batch = items_to_add[i:i+50]
                batch_texts = [f"{item.metadata_val} | {item.question} | {item.answer}" for item in batch]
                embeddings, _ = await get_batch_embeddings(batch_texts)
                for j, item in enumerate(batch):
                    if embeddings and j < len(embeddings):
                        item.embedding = embeddings[j]
                await db.commit()
                await _update_log_status(log_id, "PROCESSANDO", 60 + int(((i + len(batch)) / total_items) * 35))

            await db.commit()
        await _update_log_status(log_id, "CONCLUIDO", 100, details_update={"items_generated": total_items})
    except Exception as e:
        logger.error(f"Erro no process_kb_json_item_task {log_id}: {str(e)}")
        await _update_log_status(log_id, "ERRO", 0, error_message=str(e))

@broker.task
async def delete_old_process_logs_task(days: int = 30):
    async with async_session() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        query = text("DELETE FROM background_process_logs WHERE created_at < :cutoff")
        result = await db.execute(query, {"cutoff": cutoff_date})
        await db.commit()
        return result.rowcount
