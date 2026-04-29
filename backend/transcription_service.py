import os
import assemblyai as aai

def transcribe_video(file_path: str, config_params: dict = None) -> dict:
    """
    Transcreve um arquivo de áudio ou vídeo usando AssemblyAI com configurações personalizadas.
    """
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key or api_key == "YOUR_ASSEMBLY_API_KEY_HERE":
        raise ValueError("ASSEMBLYAI_API_KEY não configurada corretamente no .env")
    
    aai.settings.api_key = api_key
    
    # Mapeia as configurações recebidas para o objeto TranscriptionConfig do AssemblyAI
    trans_config = aai.TranscriptionConfig(
        speech_model="best",
        language_detection=config_params.get("autoLanguage", True) if config_params else True,
        language_code=config_params.get("language", "pt") if config_params and not config_params.get("autoLanguage") else None,
        speaker_labels=config_params.get("speakerLabels", False) if config_params else False,
        filter_profanity=config_params.get("profanityFilter", False) if config_params else False,
        summarization=config_params.get("summarization", False) if config_params else False,
        summary_model=aai.SummarizationModel.informative if config_params and config_params.get("summarization") else None,
        summary_type=aai.SummarizationType.bullets if config_params and config_params.get("summarization") else None
    )
    
    transcriber = aai.Transcriber()
    
    # Faz o upload e solicita a transcrição
    transcript = transcriber.transcribe(file_path, config=trans_config)
    
    if transcript.status == aai.TranscriptStatus.error:
        raise Exception(f"Erro na transcrição: {transcript.error}")
        
    return {
        "text": transcript.text,
        "duration": transcript.audio_duration # Duração em segundos
    }
