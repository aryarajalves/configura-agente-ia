import asyncio
from sqlalchemy import select
from src.database import engine, get_db
from src.models.admin import Admin, AdminRole
from passlib.context import CryptContext
from sqlalchemy.orm import Session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    email = "admin@fluxai.com"
    password = "admin"
    
    print(f"🚀 Creating default admin: {email} / {password}...")
    
    async with engine.begin() as conn:
        # Since we are using async engine, we need to handle sessions properly
        pass

    # Simplified version using synchronous session for ease of creation via script
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import create_engine
    import os
    from dotenv import load_dotenv
    
    load_dotenv("../.env")
    db_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
    
    sync_engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=sync_engine)
    db = SessionLocal()
    
    try:
        # Check if exists
        result = db.execute(select(Admin).where(Admin.email == email))
        admin = result.scalar_one_or_none()
        if admin:
            print("✅ Admin already exists.")
            return
            
        new_admin = Admin(
            email=email,
            password_hash=pwd_context.hash(password),
            role=AdminRole.SUPERADMIN
        )
        db.add(new_admin)
        db.commit()
        print("✅ Admin created successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
