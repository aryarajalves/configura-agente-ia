import pytest
import os
from jose import jwt
from datetime import datetime, timezone, timedelta
from main import create_access_token, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

def test_token_expiration_duration():
    # Test that a token generated without explicit duration uses ACCESS_TOKEN_EXPIRE_MINUTES
    data = {"sub": "test@example.com"}
    token = create_access_token(data=data)
    
    # Decode without verification to check the exp claim
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    
    exp = payload.get("exp")
    assert exp is not None
    
    # Calculate difference
    expire_time = datetime.fromtimestamp(exp, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    
    diff = expire_time - now
    # It should be close to ACCESS_TOKEN_EXPIRE_MINUTES minutes
    # We allow some seconds of leeway for code execution
    expected_seconds = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert abs(diff.total_seconds() - expected_seconds) < 10

def test_token_with_custom_expiration():
    # Test that explicit duration is still respected
    data = {"sub": "test@example.com"}
    custom_delta = timedelta(minutes=5)
    token = create_access_token(data=data, expires_delta=custom_delta)
    
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    exp = payload.get("exp")
    
    expire_time = datetime.fromtimestamp(exp, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    
    diff = expire_time - now
    assert abs(diff.total_seconds() - 300) < 10
