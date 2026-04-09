from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    b2_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = "fluxai-ingestion"
    redis_url: str = "redis://redis:6379/0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
