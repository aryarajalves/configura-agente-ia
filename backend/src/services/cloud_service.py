import os
import boto3
from botocore.config import Config
from src.core.config import settings
import logging

logger = logging.getLogger(__name__)

class CloudService:
    """
    Standardized S3-compatible Cloud Service using boto3.
    Works with AWS S3, Backblaze B2, Cloudflare R2, etc.
    """
    def __init__(self):
        self.bucket_name = settings.s3_bucket_name
        self.enabled = settings.s3_enabled
        
        if not self.enabled:
            self.s3_client = None
            return

        # Configure S3 Client
        s3_config = {
            "aws_access_key_id": settings.s3_access_key_id,
            "aws_secret_access_key": settings.s3_secret_access_key,
            "region_name": settings.s3_region or None
        }
        
        # If endpoint is provided, it's likely a non-AWS S3 provider (like B2)
        if settings.s3_endpoint_url:
            s3_config["endpoint_url"] = settings.s3_endpoint_url

        self.s3_client = boto3.client("s3", **s3_config)

    def upload_file(self, local_path: str, remote_filename: str) -> str:
        """
        Uploads a local file to S3 and returns the object key.
        """
        if not self.s3_client:
            raise Exception("Cloud storage is disabled or not configured.")

        try:
            self.s3_client.upload_file(local_path, self.bucket_name, remote_filename)
            logger.info(f"File {remote_filename} uploaded successfully to {self.bucket_name}")
            return remote_filename # For S3, the key is the ID
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}")
            raise

    def delete_file(self, remote_filename: str, remote_id: str = None) -> bool:
        """
        Deletes a file from S3.
        """
        if not self.s3_client:
            return False

        try:
            # remote_id was used for B2 specific IDs, for S3 we use the key (remote_filename)
            key = remote_id or remote_filename
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from S3: {e}")
            return False
