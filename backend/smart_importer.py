import io
import pdfplumber
import PyPDF2
from typing import List, Dict, Any, Union
import openai
import os
import json
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from config_store import get_real_model_id, MODEL_INFO
import re

load_dotenv()

async def extract_text_from_url(url: str) -> str:
    """
    Fetches the content of a URL and extracts the main text.
    """
    try:
        response = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        })
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()
            
        # Get text with a separator
        text = soup.get_text(separator=' ')
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        print(f"Error scraping URL: {e}")
        return ""

async def extract_text_from_image(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Uses GPT-4o with Vision to extract all text from an image.
    Returns as a list of page objects for consistency with PDF extractor.
    """
    from agent import get_openai_client
    import base64
    
    client = get_openai_client("gpt-4o")
    if not client:
        return []
        
    base64_image = base64.b64encode(file_content).decode('utf-8')
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extraia todo o texto literal desta imagem. Retorne apenas o texto encontrado, mantendo a formatação e quebras de linha se possível. Se houver tabelas, mantenha a estrutura de colunas."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            },
                        },
                    ],
                }
            ],
            max_tokens=4000,
        )
        
        extracted_text = response.choices[0].message.content
        return [{
            "text": extracted_text,
            "page": 1
        }]
    except Exception as e:
        print(f"Error extracting text from image with Vision: {e}")
        return []

async def extract_text_from_image_b64(base64_image: str) -> str:
    """
    Uses GPT-4o with Vision to extract/describe content from a base64-encoded image.
    Returns plain text string (for embedding into section text).
    """
    from agent import get_openai_client

    client = get_openai_client("gpt-4o")
    if not client:
        return ""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Esta é uma página de um manual técnico. "
                                "Descreva detalhadamente qualquer gráfico, diagrama, tabela ou imagem presente. "
                                "Se houver texto nas imagens, transcreva-o. "
                                "Se houver botões ou ícones de interface, descreva sua função. "
                                "Retorne apenas o conteúdo extraído, sem comentários adicionais."
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{base64_image}"},
                        },
                    ],
                }
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        print(f"[Vision b64] Error: {e}")
        return ""


async def render_page_as_image(file_input: Union[bytes, str], page_num: int) -> str | None:
    """
    Renders a PDF page to a base64 PNG image using pypdfium2 (already in requirements).
    Returns base64 string or None on error.
    """
    try:
        import pypdfium2 as pdfium
        import io
        import base64

        pdf = pdfium.PdfDocument(file_input)
        if page_num < 1 or page_num > len(pdf):
            return None
        page = pdf[page_num - 1]
        bitmap = page.render(scale=2.0)  # ~144 DPI
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format='PNG')
        return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"[Vision] Erro ao renderizar página {page_num}: {e}")
        return None


async def extract_visual_content_from_section(file_input: Union[bytes, str], section: dict) -> str:
    """
    For pages in the section that have images/graphics (detected by pdfplumber),
    renders them via pypdfium2 and calls GPT-4o Vision to extract visual content.
    Returns a string to append to the section text.
    """
    import io
    import pdfplumber

    visual_parts = []
    try:
        source = file_input if isinstance(file_input, str) else io.BytesIO(file_input)
        with pdfplumber.open(source) as pdf:
            total_pages = len(pdf.pages)
            start = section.get("start_page", 1)
            end = section.get("end_page", total_pages)

            for page_num in range(start, min(end + 1, total_pages + 1)):
                page = pdf.pages[page_num - 1]
                if page.images:
                    b64 = await render_page_as_image(file_input, page_num)
                    if b64:
                        content = await extract_text_from_image_b64(b64)
                        if content and content.strip():
                            visual_parts.append(f"[Página {page_num} - Conteúdo Visual]:\n{content}")
    except Exception as e:
        print(f"[Vision] Erro ao processar seção '{section.get('title')}': {e}")

    return "\n\n".join(visual_parts)


def detect_sections(pages_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detects section boundaries in PDF text by identifying heading lines
    (ALL_CAPS, short, no trailing period).
    Returns: [{title, text, start_page, end_page}, ...]
    """
    import re

    HEADING_RE = re.compile(r'^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s/\-]{3,60}$')
    MIN_SECTION_CHARS = 200

    sections = []
    current_title = "Introdução"
    current_pages: List[Dict[str, Any]] = []
    current_start = pages_data[0]["page"] if pages_data else 1

    def flush_section():
        nonlocal current_title, current_pages, current_start
        combined = "\n".join(p.get("text", "") for p in current_pages)
        if combined.strip() and len(combined) >= MIN_SECTION_CHARS:
            sections.append({
                "title": current_title,
                "text": combined,
                "start_page": current_start,
                "end_page": current_pages[-1]["page"] if current_pages else current_start,
            })

    for page_obj in pages_data:
        lines = (page_obj.get("text") or "").split('\n')
        found_heading = False
        for line in lines:
            stripped = line.strip()
            if (
                stripped
                and HEADING_RE.match(stripped)
                and len(stripped) >= 3
                and not stripped.endswith('.')
                and len(stripped.split()) <= 8
            ):
                flush_section()
                current_title = stripped.title()
                current_pages = []
                current_start = page_obj["page"]
                found_heading = True
                break
        current_pages.append(page_obj)

    flush_section()  # flush last section

    # Fallback: if fewer than 3 sections detected, treat entire doc as one
    if len(sections) < 3:
        full_text = "\n".join(p.get("text", "") for p in pages_data)
        return [{
            "title": "Documento Completo",
            "text": full_text,
            "start_page": pages_data[0]["page"] if pages_data else 1,
            "end_page": pages_data[-1]["page"] if pages_data else 1,
        }]

    print(f"[Sections] Detected {len(sections)} sections: {[s['title'] for s in sections]}")
    return sections


async def extract_text_from_pdf(file_input: Union[bytes, str], start_page: int = 1, end_page: int = None) -> List[Dict[str, Any]]:
    """
    Extracts text from a PDF file as a list of page objects with text and page number.
    Support both bytes (legacy) and file path (streaming).
    """
    pages_data = []
    try:
        source = file_input if isinstance(file_input, str) else io.BytesIO(file_input)
        with pdfplumber.open(source) as pdf:
            total_pages = len(pdf.pages)
            
            # Adjust range
            start_idx = max(0, start_page - 1)
            if end_page is None or end_page > total_pages:
                end_idx = total_pages
            else:
                end_idx = end_page
            
            for i in range(start_idx, end_idx):
                page = pdf.pages[i]
                # Improve table handling: extract tables and text together or at least ensure spacing
                page_text = page.extract_text(layout=True) or ""
                
                # Check for tables to potentially improve structure
                tables = page.extract_tables()
                if tables:
                    # If tables exist, we could append them in a cleaner format, but for now 
                    # extract_text(layout=True) helps maintain columns
                    pass
                
                pages_data.append({
                    "text": page_text,
                    "page": i + 1
                })
                
    except Exception as e:
        print(f"DEBUG ERROR: Error extracting PDF: {e}")
        return []
        
    total_chars = sum(len(p["text"]) for p in pages_data)
    print(f"DEBUG: PDF Extraction successful. Total pages: {len(pages_data)}, Total chars: {total_chars}")
    return pages_data

def chunk_text(pages_data: Union[List[Dict[str, Any]], str], chunk_size: int = 1500, overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Splits text from pages or a single string into chunks, preserving page metadata if available.
    """
    if isinstance(pages_data, str):
        pages_data = [{"text": pages_data, "page": None}]
        
    all_chunks = []
    
    for page_obj in pages_data:
        text = page_obj["text"]
        page_num = page_obj["page"]
        
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = start + chunk_size
            if end >= text_len:
                all_chunks.append({
                    "text": text[start:],
                    "metadata": {"page": page_num}
                })
                break
                
            # Try to find a sentence break near the end
            # Search backwards from 'end' to find a period or newline
            last_period = text.rfind('.', start, end)
            last_newline = text.rfind('\n', start, end)
            
            break_point = max(last_period, last_newline)
            
            if break_point != -1 and break_point > start + (chunk_size // 2):
                end = break_point + 1
            
            all_chunks.append({
                "text": text[start:end],
                "metadata": {"page": page_num}
            })
            start = end - overlap
        
    return all_chunks

def extract_json_list(text: str) -> List[Dict[str, Any]]:
    """
    Attempts to extract a JSON list from a string that might contain extra text or markdown blocks.
    Supports truncated lists by attempting to close them.
    """
    content = text.strip()
    
    # 1. Basic Markdown Cleanup
    if content.startswith("```json"):
        content = content[7:]
    if content.endswith("```"):
        content = content[:-3]
    if content.startswith("```"): 
        content = content[3:]
    
    content = content.strip()
    
    # 2. Try direct load
    try:
        data = json.loads(content)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # 3. Robust Search for [ ... ]
    match = re.search(r'\[.*', content, re.DOTALL)
    if not match:
        return []
    
    list_str = match.group().strip()
    
    # Try to find the last complete closing ]
    last_bracket = list_str.rfind(']')
    if last_bracket != -1:
        valid_part = list_str[:last_bracket+1]
        try:
            data = json.loads(valid_part)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass
            
    # 4. Handle Truncation: find the last complete object { ... }
    # Remove any trailing incomplete content and force-close the list
    try:
        # Find last complete object closing
        last_obj_close = list_str.rfind('}')
        if last_obj_close != -1:
            truncated_list = list_str[:last_obj_close+1]
            # Ensure it ends like ...}]
            if not truncated_list.strip().endswith(']'):
                truncated_list += ']'
            
            data = json.loads(truncated_list)
            if isinstance(data, list):
                return data
    except Exception:
        pass

    return []

async def generate_qa_from_text(text_chunk: str, num_questions: int = 2, model: str = "gpt-4o-mini") -> tuple[List[Dict[str, str]], Dict[str, Any] | None]:
    """
    Uses OpenAI to generate concise Q&A pairs from a text chunk.
    Returns (qa_list, usage_dict)
    """
    from agent import get_openai_client
    
    # Resolve family name to real API ID
    api_model = get_real_model_id(model)
    
    client = get_openai_client(model) # Centralized client handles Gemini vs OpenAI
    if not client:
        return [], None

    prompt = f"""
    Você é um especialista em análise de documentos. 
    Abaixo está um trecho de um texto. Sua tarefa é extrair e transformar esse conhecimento em EXATAMENTE {num_questions} pares de Pergunta e Resposta.

    ATENÇÃO: É um requisito técnico crítico que você retorne EXATAMENTE {num_questions} itens. Nem um a mais, nem um a menos.

    Texto:
    ---
    {text_chunk}
    ---

    Regras:
    1. Baseie-se apenas no texto fornecido.
    2. Seja claro e objetivo.
    3. Retorne APENAS o JSON puro no formato abaixo:
    [
      {{"pergunta": "...", "resposta": "...", "categoria": "Trecho do Documento", "trecho_original": "Citação exata do texto usada para esta resposta", "pagina": N, "metadado": "Opcional: palavras-chave ou contexto extra"}}
    ]
    """

    try:
        print(f"DEBUG AI: Calling {api_model} (family: {model}) for Chunk QA...")
        
        
        model_config = MODEL_INFO.get(model, {})
        supports_temp = model_config.get("supports_temperature", True)
        is_o1_model = api_model.startswith("o1") or not supports_temp
        
        messages = []
        if is_o1_model:
            messages.append({"role": "user", "content": prompt})
        else:
            messages.append({"role": "user", "content": prompt})
        
        call_kwargs = {
            "model": api_model,
            "messages": messages,
        }
        
        if is_o1_model:
            call_kwargs["max_completion_tokens"] = 1000
        else:
            call_kwargs["max_tokens"] = 1000

        response = await client.chat.completions.create(**call_kwargs)
        
        usage = {
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
            "model": api_model,
            "family": model
        }
        
        content = response.choices[0].message.content.strip()
        print(f"DEBUG AI: Raw response from {api_model}: {content[:500]}...")
        
        qa_list = extract_json_list(content)
        if qa_list:
            return qa_list, usage
        else:
            print(f"Failed to decode JSON from LLM: {content}")
            return [], usage
            
    except Exception as e:
        print(f"DEBUG ERROR: Error generating Q&A: {e}")
        return [], None

    return [], None

async def generate_global_qa(full_text: str, total_questions: int = 10, user_suggestions: str = None, extraction_type: str = 'suggestions', model: str = "gpt-4o-mini") -> tuple[List[Dict[str, str]], Dict[str, Any] | None]:
    """
    Orchestrator for global QA extraction. Resolves model, manages text limit, and handles retries.
    """
    
    try:
        api_model = get_real_model_id(model)
        
        # Determine text limit based on model capability
        char_limit = 350000 
        if "gemini" in api_model.lower():
            char_limit = 2000000
        elif "o1" in api_model.lower() or "gpt-4o" in api_model.lower() or "gpt-5" in model.lower():
            char_limit = 500000
            
        safe_text = full_text[:char_limit]
        print(f"DEBUG: Starting Global QA. Text slice: {len(safe_text)} chars. Model: {model} -> {api_model}")

        if not safe_text.strip():
            print("DEBUG ERROR: No text available for Global QA.")
            return [], {}

        try:
            qa_list, usage = await _call_global_qa_api(safe_text, total_questions, user_suggestions, extraction_type, api_model, model)
            
            # If main model returned success but 0 items (rare but possible), try one more time with mini
            if not qa_list and api_model != "gpt-4o-mini":
                print(f"⚠️ Primary model {api_model} returned 0 items. Retrying with gpt-4o-mini as fallback...")
                qa_list, usage = await _call_global_qa_api(safe_text, total_questions, user_suggestions, extraction_type, "gpt-4o-mini", "gpt-4o-mini")
            
            return qa_list, usage

        except Exception as api_err:
            print(f"⚠️ Primary model {api_model} failed: {api_err}. Trying fallback gpt-4o-mini...")
            return await _call_global_qa_api(safe_text, total_questions, user_suggestions, extraction_type, "gpt-4o-mini", "gpt-4o-mini")

    except Exception as e:
        print(f"DEBUG ERROR: Global QA Orchestrator Error: {e}")
        return [], {}

async def _call_global_qa_api(text: str, count: int, suggestions: str, ext_type: str, api_model: str, family: str):
    """Internal helper to call the LLM and parse JSON."""
    from agent import get_openai_client
    
    client = get_openai_client(api_model)
    if not client:
        print(f"DEBUG ERROR: Could not get client for model {api_model}")
        return [], {}

    model_config = MODEL_INFO.get(family, {})
    supports_temp = model_config.get("supports_temperature", True)
    is_o1_model = api_model.startswith("o1") or api_model.startswith("gpt-5") or not supports_temp

    category_label = "Extração Direta" if ext_type == "specific" else "Documento"

    suggestions_prompt = ""
    if ext_type == "specific" and suggestions:
        lines = [l.strip() for l in suggestions.split('\n') if l.strip()]
        q_list_str = "\n".join([f"- {q}" for q in lines])
        suggestions_prompt = f"""
        O usuário forneceu perguntas EXATAS que ele deseja ver respondidas:
        {q_list_str}
        
        Sua missão é ler o documento e responder APENAS a essas perguntas. 
        Mantenha a pergunta original do usuário e extraia a resposta mais completa possível do texto fornecido.
        """
    else:
        suggestions_prompt = f"Fio Condutor / Sugestões do Usuário: '{suggestions}'. Foque nesses temas se possível."

    prompt = f"""
    Você é um Especialista em Gestão de Conhecimento e Engenheiro de Prompt de elite.
    Sua missão é transformar o documento técnico abaixo em uma base de conhecimento de ALTA PERFORMANCE.

    DOCUMENTO PARA ANÁLISE:
    ---
    {text}
    ---
    
    OBJETIVO: {f"Responder detalhadamente às {count} perguntas abaixo." if ext_type == "specific" else f"Extrair os conceitos-chave, regras de negócio e definições cruciais, criando até {count} pares de P&R."}
    
    REQUISITOS DE ELITE (NÃO NEGOCIÁVEIS):
    1. PROFUNDIDADE ÚTIL: Se o texto define termos (ex: tipos de dívidas, status), a resposta DEVE explicar cada um deles detalhadamente, não apenas citar que existem.
    2. TOM PEDAGÓGICO: Escreva como um consultor sênior ensinando um novo usuário. Use listas e formatações se ajudar na clareza.
    3. FIDELIDADE ABSOLUTA: Extraia a informação exata do texto. Se o texto for técnico, mantenha a precisão técnica.
    4. CITAÇÃO OBRIGATÓRIA: Para CADA par de P&R, você DEVE retornar no campo "trecho_original" o parágrafo EXATO do documento onde essa informação foi encontrada. Não repita o mesmo trecho para todas as perguntas; cada uma deve apontar para sua fonte específica.
    5. {suggestions_prompt}
    
    6. EVITE A PREGUIÇA: Não retorne respostas de uma linha para perguntas complexas. Se houver detalhes no manual, use-os.
    
    {f"IMPORTANTE: Responda obrigatoriamente a cada uma das {count} perguntas listadas." if ext_type == "specific" else ""}

    FORMATO DE RETORNO (JSON PURO):
    [
      {{"pergunta": "Texto da pergunta clara e profissional", "resposta": "Explicação profunda, completa e detalhada baseada no manual", "categoria": "{category_label}", "trecho_original": "O trecho do texto que fundamentou essa informação", "pagina": 1, "metadado": "Opcional: palavras-chave, tags adicionais ou contexto extra sobre este item"}}
    ]
    """

    messages = []
    if is_o1_model:
        combined_prompt = "INSTRUÇÃO DO SISTEMA: Você é um assistente especializado em extrair conhecimento profundo de manuais técnicos. Sua prioridade é a exatidão e a completude da informação.\n\n" + prompt
        messages.append({"role": "user", "content": combined_prompt})
    else:
        messages.append({"role": "system", "content": "Você é um assistente especializado em extrair conhecimento profundo de manuais técnicos. Sua prioridade é a exatidão e a completude da informação."})
        messages.append({"role": "user", "content": prompt})

    print(f"DEBUG AI: Calling {api_model} for GLOBAL QA...")
    
    call_kwargs = {
        "model": api_model,
        "messages": messages,
    }
    
    if is_o1_model:
        call_kwargs["max_completion_tokens"] = 8000
    else:
        call_kwargs["temperature"] = 0.4
        call_kwargs["max_tokens"] = 8000 

    response = await client.chat.completions.create(**call_kwargs)
    
    usage = {
        "input_tokens": response.usage.prompt_tokens,
        "output_tokens": response.usage.completion_tokens,
        "model": api_model,
        "family": family
    }

    content = response.choices[0].message.content
    print(f"DEBUG AI: Raw GLOBAL response from {api_model}: {content[:500]}...")

    qa_list = extract_json_list(content)
    if qa_list:
        print(f"DEBUG: Successfully generated {len(qa_list)} items with {api_model}")
    else:
        print(f"DEBUG ERROR: JSON Extraction failed from {api_model}. Raw response (first 200 chars): {content[:200]}")
        
    return qa_list or [], usage
