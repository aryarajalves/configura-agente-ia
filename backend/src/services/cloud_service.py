import os
from b2sdk.v2 import InMemoryAccountInfo, B2Api
from src.core.config import settings

class CloudService:
    def __init__(self):
        self.info = InMemoryAccountInfo()
        self.b2_api = B2Api(self.info)
        
        key_id = settings.b2_key_id or os.environ.get("B2_KEY_ID")
        app_key = settings.b2_application_key or os.environ.get("B2_APPLICATION_KEY")
        
        if key_id and app_key:
            self.b2_api.authorize_account("production", key_id, app_key)
        
        self.bucket_name = settings.b2_bucket_name or os.environ.get("B2_BUCKET_NAME", "fluxai-ingestion")

    def upload_file(self, file_path: str, remote_filename: str) -> str:
        bucket = self.b2_api.get_bucket_by_name(self.bucket_name)
        file_info = bucket.upload_local_file(
            local_file=file_path,
            file_name=remote_filename
        )
        return file_info.id_

    def delete_file(self, file_id: str, file_name: str) -> bool:
        try:
            self.b2_api.delete_file_version(file_id, file_name)
            return True
        except Exception:
            return False
