"""Signed URL generation for recording playback"""
from typing import Optional
from config import Config
import logging
import boto3
from botocore.exceptions import ClientError
from datetime import timedelta

logger = logging.getLogger(__name__)

async def get_signed_recording_url(
    bucket: str,
    object_path: str,
    expiration_seconds: int = 3600
) -> Optional[str]:
    """
    Generate a signed URL for S3 object playback
    
    Args:
        bucket: S3 bucket name
        object_path: S3 object key/path
        expiration_seconds: URL expiration time (default 1 hour)
    
    Returns:
        Signed URL or None if error
    """
    try:
        s3_client = boto3.client(
            's3',
            region_name=Config.AWS_REGION,
            aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY
        )
        
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': object_path},
            ExpiresIn=expiration_seconds
        )
        
        logger.info(f"✅ Generated signed URL for {object_path} (expires in {expiration_seconds}s)")
        return url
        
    except ClientError as e:
        logger.error(f"❌ Failed to generate signed URL: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ Unexpected error generating signed URL: {e}")
        return None

