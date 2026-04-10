import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.admin import Admin, AdminRole
from typing import Optional
import os

class AuthService:
    @staticmethod
    async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[Admin]:
        """
        Authenticates an admin user checking email and password hash.
        """
        result = await db.execute(select(Admin).where(Admin.email == email, Admin.deleted_at == None))
        user = result.scalars().first()
        
        if user:
            if bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
                return user
        
        # Fallback to .env credentials
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        
        if admin_email and admin_password and email == admin_email and password == admin_password:
            # Try to find or create the admin in DB to have a consistent ID and Role
            result = await db.execute(select(Admin).where(Admin.email == email))
            db_user = result.scalars().first()
            
            if not db_user:
                # Create the superadmin if it doesn't exist
                salt = bcrypt.gensalt()
                new_admin = Admin(
                    email=email,
                    name="Super Admin",
                    password_hash=bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8'),
                    role=AdminRole.SUPERADMIN
                )
                db.add(new_admin)
                await db.commit()
                await db.refresh(new_admin)
                return new_admin
            else:
                # Update role and name if they differ from .env expectations
                changed = False
                if db_user.role != AdminRole.SUPERADMIN:
                    db_user.role = AdminRole.SUPERADMIN
                    changed = True
                if not db_user.name:
                    db_user.name = "Super Admin"
                    changed = True
                
                if changed:
                    await db.commit()
                    await db.refresh(db_user)
                return db_user
            
        return None

    @staticmethod
    async def update_admin(db: AsyncSession, admin_id: str, update_data: dict) -> Optional[Admin]:
        """
        Updates an admin profile.
        """
        result = await db.execute(select(Admin).where(Admin.id == admin_id))
        admin = result.scalars().first()
        if not admin:
            return None
            
        if "name" in update_data:
            admin.name = update_data["name"]
        if "email" in update_data:
            admin.email = update_data["email"]
        if "password" in update_data and update_data["password"]:
            # Hash new password
            salt = bcrypt.gensalt()
            admin.password_hash = bcrypt.hashpw(update_data["password"].encode('utf-8'), salt).decode('utf-8')
            
        await db.commit()
        await db.refresh(admin)
        return admin

    @staticmethod
    def create_access_token(data: dict):
        """
        Wrapper to call the token creation logic from src.api.auth.
        """
        from src.api.auth import create_access_token
        return create_access_token(data)
