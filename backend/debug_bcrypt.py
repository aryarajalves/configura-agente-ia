from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
try:
    h = pwd_context.hash("password123")
    print(f"Hash success: {h}")
except Exception as e:
    print(f"Hash failed: {e}")
