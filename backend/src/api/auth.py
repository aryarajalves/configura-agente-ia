import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.models.admin import AdminRole, Admin

# Secret keys and algorithms
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
# Long-lived tokens: 30 days for persistent sessions (T020)
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

security = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(default=None),
):
    """
    Accepts token from:
    1. Authorization: Bearer <token> header (primary)
    2. access_token HttpOnly cookie (fallback for persistent sessions)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Resolve token from header or cookie
    raw_token: Optional[str] = None
    if bearer and bearer.credentials:
        raw_token = bearer.credentials
    elif access_token:
        raw_token = access_token

    if raw_token is None:
        raise credentials_exception

    try:
        payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("id") or payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Return full payload so email and role are accessible downstream
    return {
        "id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role"),
        "name": payload.get("name"),
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
