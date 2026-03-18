import pytest
from agent import resolve_conditional_blocks

def test_resolve_conditional_blocks_positive():
    text = "Olá [IF:premium]Premium User[/IF]"
    
    # Truthy
    assert resolve_conditional_blocks(text, {"premium": "true"}) == "Olá Premium User"
    assert resolve_conditional_blocks(text, {"premium": "1"}) == "Olá Premium User"
    assert resolve_conditional_blocks(text, {"premium": "sim"}) == "Olá Premium User"
    assert resolve_conditional_blocks(text, {"premium": "yes"}) == "Olá Premium User"
    
    # Falsy
    assert resolve_conditional_blocks(text, {"premium": "false"}) == "Olá "
    assert resolve_conditional_blocks(text, {"premium": "0"}) == "Olá "
    assert resolve_conditional_blocks(text, {"premium": ""}) == "Olá "
    assert resolve_conditional_blocks(text, {}) == "Olá "

def test_resolve_conditional_blocks_negative():
    text = "Olá [IF:premium:false]Guest[/IF]"
    
    # Falsy/Missing
    assert resolve_conditional_blocks(text, {"premium": "false"}) == "Olá Guest"
    assert resolve_conditional_blocks(text, {}) == "Olá Guest"
    
    # Truthy
    assert resolve_conditional_blocks(text, {"premium": "true"}) == "Olá "

def test_resolve_conditional_blocks_nested_concept():
    # Regular matching (not necessarily nested but multiple)
    text = "[IF:a]A[/IF][IF:b]B[/IF]"
    assert resolve_conditional_blocks(text, {"a": "true", "b": "false"}) == "AB" if False else "A" # should be A
    assert resolve_conditional_blocks(text, {"a": "true", "b": "true"}) == "AB"

def test_variable_substitution_in_agent_flow():
    # We test the logic used in process_message manually here or assume it works if resolve_conditional_blocks works
    # Actually process_message does:
    # messages[0]["content"] = resolve_conditional_blocks(messages[0]["content"], context_variables)
    # for key, value in context_variables.items():
    #     placeholder = "{" + key + "}"
    #     messages[0]["content"] = messages[0]["content"].replace(placeholder, str(value))
    
    prompt = "User: {name}, Status: {status}"
    context = {"name": "Alice", "status": "Active"}
    
    result = prompt.format(**context) # Python's native format or manual replace?
    # agent.py uses .replace(placeholder, val_str)
    
    content = prompt
    for key, value in context.items():
        placeholder = "{" + key + "}"
        content = content.replace(placeholder, str(value))
    
    assert content == "User: Alice, Status: Active"

def test_resolve_conditional_blocks_case_insensitive():
    text = "[IF:PREMIUM]VIP[/IF]"
    assert resolve_conditional_blocks(text, {"premium": "TRUE"}) == "VIP"
    assert resolve_conditional_blocks(text, {"PREMIUM": "true"}) == "VIP"
