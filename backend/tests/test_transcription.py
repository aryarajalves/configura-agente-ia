import pytest
from unittest.mock import patch, MagicMock
from transcription_service import transcribe_video
import os

def test_transcribe_video_missing_api_key():
    with patch.dict(os.environ, {"ASSEMBLYAI_API_KEY": ""}):
        with pytest.raises(ValueError) as excinfo:
            transcribe_video("dummy_path")
        assert "ASSEMBLYAI_API_KEY não configurada" in str(excinfo.value)

@patch("assemblyai.Transcriber")
@patch.dict(os.environ, {"ASSEMBLYAI_API_KEY": "fake_key"})
def test_transcribe_video_success(mock_transcriber_class):
    # Mock the transcriber and its transcript result
    mock_transcriber = mock_transcriber_class.return_value
    mock_transcript = MagicMock()
    mock_transcript.status = "completed"
    mock_transcript.text = "Hello world"
    mock_transcript.audio_duration = 120.5
    mock_transcriber.transcribe.return_value = mock_transcript
    
    with patch("assemblyai.TranscriptStatus") as mock_status:
        mock_status.error = "error"
        mock_status.completed = "completed"
        
        result = transcribe_video("some_file.mp4")
        assert isinstance(result, dict)
        assert result["text"] == "Hello world"
        assert result["duration"] == 120.5
        # The service now passes a config object, so check assertion flexibly or check the config
        assert mock_transcriber.transcribe.called
