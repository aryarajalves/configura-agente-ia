"""
users.py — Admin / User management endpoints.
Restores GET /v1/users for frontend UserManagement page.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from src.database import get_db
from src.api.auth import get_superadmin
from src.models.admin import Admin, AdminRole
from src.models.schemas import SuccessResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid
import bcrypt

router = APIRouter()


class UserCreateSchema(BaseModel):
    name: str
    email: str
    password: str
    role: str = "USER"
    status: str = "ATIVO"


class UserUpdateSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


def _admin_to_dict(admin: Admin) -> dict:
    return {
        "id": str(admin.id),
        "name": admin.name or "",
        "email": admin.email,
        "role": admin.role.value if hasattr(admin.role, 'value') else str(admin.role),
        "status": "ATIVO" if admin.deleted_at is None else "INATIVO",
        "created_at": admin.created_at.isoformat() if admin.created_at else None,
    }


@router.get("", response_model=SuccessResponse)
async def list_users(
    admin: dict = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """List all admin/user accounts (excluding soft-deleted)."""
    result = await db.execute(
        select(Admin).where(Admin.deleted_at == None).order_by(Admin.created_at)
    )
    admins = result.scalars().all()
    return SuccessResponse(data=[_admin_to_dict(a) for a in admins])


@router.post("", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateSchema,
    admin: dict = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new admin/user account."""
    # Check for duplicate email
    existing = await db.execute(select(Admin).where(Admin.email == payload.email, Admin.deleted_at == None))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Email já cadastrado.")

    # Map role string to enum
    role_map = {
        "SUPERADMIN": AdminRole.SUPERADMIN,
        "ADMIN": AdminRole.ADMIN,
        "USER": AdminRole.USER,
        "Usuário": AdminRole.USER,
    }
    role = role_map.get(payload.role, AdminRole.USER)

    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(payload.password.encode('utf-8'), salt).decode('utf-8')

    new_user = Admin(
        id=uuid.uuid4(),
        email=payload.email,
        name=payload.name,
        password_hash=password_hash,
        role=role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return SuccessResponse(data=_admin_to_dict(new_user), message="Usuário criado com sucesso!")


@router.put("/{user_id}", response_model=SuccessResponse)
async def update_user(
    user_id: str,
    payload: UserUpdateSchema,
    admin: dict = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Update a user account."""
    result = await db.execute(select(Admin).where(Admin.id == user_id, Admin.deleted_at == None))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        user.email = payload.email
    if payload.password:
        salt = bcrypt.gensalt()
        user.password_hash = bcrypt.hashpw(payload.password.encode('utf-8'), salt).decode('utf-8')
    if payload.role is not None:
        role_map = {"SUPERADMIN": AdminRole.SUPERADMIN, "ADMIN": AdminRole.ADMIN, "USER": AdminRole.USER}
        user.role = role_map.get(payload.role, user.role)

    await db.commit()
    await db.refresh(user)
    return SuccessResponse(data=_admin_to_dict(user), message="Usuário atualizado!")


@router.delete("/{user_id}", response_model=SuccessResponse)
async def delete_user(
    user_id: str,
    admin: dict = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db)
):
    """Soft-delete a user account."""
    from datetime import datetime
    result = await db.execute(select(Admin).where(Admin.id == user_id, Admin.deleted_at == None))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user.deleted_at = datetime.utcnow()
    await db.commit()
    return SuccessResponse(message="Usuário removido com sucesso.")
