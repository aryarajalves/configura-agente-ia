import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
import logging
from src.core.config import settings

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.enabled = settings.s3_enabled
        self.endpoint_url = settings.s3_endpoint_url
        self.access_key_id = settings.s3_access_key_id
        self.secret_access_key = settings.s3_secret_access_key
        self.bucket_name = settings.s3_bucket_name
        self.region = settings.s3_region

        if self.enabled:
            config_params = {
                'aws_access_key_id': self.access_key_id,
                'aws_secret_access_key': self.secret_access_key,
                'region_name': self.region,
                'config': Config(signature_version='s3v4')
            }
            if self.endpoint_url:
                config_params['endpoint_url'] = self.endpoint_url
                
            self.s3_client = boto3.client('s3', **config_params)
        else:
            self.s3_client = None

    def upload_fileobj(self, fileobj, object_name, content_type=None):
        """Upload a file-like object to S3."""
        if not self.enabled:
            logger.warning("S3 is disabled. File not uploaded.")
            return None

        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type

            self.s3_client.upload_fileobj(fileobj, self.bucket_name, object_name, ExtraArgs=extra_args)
            return object_name
        except Exception as e:
            logger.error(f"Error uploading to S3: {e}")
            raise e

    def get_presigned_url(self, object_name, expiration=3600):
        """Generate a presigned URL to share an S3 object."""
        if not self.enabled:
            return None

        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name},
                ExpiresIn=expiration
            )
            return response
        except Exception as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None

    def delete_object(self, object_name):
        """Delete an object from S3."""
        if not self.enabled:
            return

        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
        except Exception as e:
            logger.error(f"Error deleting from S3: {e}")

s3_service = S3Service()
