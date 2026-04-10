from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket_name: str = "agente-s3"
    s3_region: str = "us-east-1"
    s3_endpoint_url: str = ""
    s3_enabled: bool = True
    
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
