import pytest
from smart_importer import chunk_text, extract_json_list
import json

def test_chunk_text_simple():
    text = "Line 1. Line 2. Line 3. Line 4."
    # Small chunks to force splitting
    chunks = chunk_text(text, chunk_size=10, overlap=2)
    assert len(chunks) > 1
    # Check if first chunk ends with a sentence break if possible
    assert chunks[0]["text"].endswith(".")

def test_extract_json_list_clean():
    raw = '[{"a": 1}, {"b": 2}]'
    result = extract_json_list(raw)
    assert len(result) == 2
    assert result[0]["a"] == 1

def test_extract_json_list_with_markdown():
    raw = 'Here is the list: ```json\n[{"q": "1"}]\n``` enjoy.'
    result = extract_json_list(raw)
    assert len(result) == 1
    assert result[0]["q"] == "1"

def test_extract_json_list_truncated():
    # Incomplete JSON list
    raw = '[{"q": "Complete"}, {"q": "Incomplete"'
    # The function attempts to fix it or extract valid parts
    result = extract_json_list(raw)
    # Based on our implementation, it looks for last complete object } and adds ]
    assert len(result) == 1
    assert result[0]["q"] == "Complete"

def test_chunk_text_with_pages():
    pages = [
        {"text": "Page one content.", "page": 1},
        {"text": "Page two content.", "page": 2}
    ]
    chunks = chunk_text(pages, chunk_size=50)
    assert len(chunks) >= 2
    assert chunks[0]["metadata"]["page"] == 1
    assert any(c["metadata"]["page"] == 2 for c in chunks)
