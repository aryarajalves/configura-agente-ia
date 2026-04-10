import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from src.models.admin import AdminRole, Admin

# Secret keys and algorithms
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("id") or payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Return the full payload so email and role are accessible
    return {
        "id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role"),
        "name": payload.get("name")
    }

async def get_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != AdminRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: SUPERADMIN required"
        )
    return current_user


async def get_owner_or_superadmin(current_user: dict = Depends(get_current_user)):
    """Allow access to Owner (SUPERADMIN) or ADMIN roles for monitoring/audit endpoints."""
    allowed_roles = {AdminRole.SUPERADMIN, AdminRole.ADMIN}
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Owner or Admin required"
        )
    return current_user
