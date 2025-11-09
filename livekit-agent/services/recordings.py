"""Recording (Egress) service"""
from typing import Dict, Any, Optional
from livekit import api
from config import Config
import logging
import os
import io

import boto3  # for temporary S3 fetch before mirroring to Supabase
from services.supabase import get_supabase_client

logger = logging.getLogger(__name__)

async def start_recording(room_name: str) -> Optional[str]:
    """
    Start Room Composite Egress recording (audio-only OGG)
    
    Args:
        room_name: LiveKit room name
    
    Returns:
        Egress ID if successful, None otherwise
    """
    if not Config.AWS_BUCKET_NAME:
        logger.warning("⚠️ AWS_BUCKET_NAME not set - recording disabled")
        return None
    
    try:
        lkapi = api.LiveKitAPI(
            url=Config.LIVEKIT_URL,
            api_key=Config.LIVEKIT_API_KEY,
            api_secret=Config.LIVEKIT_API_SECRET
        )
        
        # Generate file path
        from datetime import datetime
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filepath = f"livekit/{room_name}_{timestamp}.ogg"
        
        # Build S3 upload target (S3-compatible supported via endpoint/path-style)
        s3_upload = api.S3Upload(
            bucket=Config.AWS_BUCKET_NAME,
            region=Config.AWS_REGION,
            access_key=Config.AWS_ACCESS_KEY_ID,
            secret=Config.AWS_SECRET_ACCESS_KEY,
        )
        # Optional fields for S3-compatible providers (e.g., MinIO)
        try:
            if Config.S3_ENDPOINT and hasattr(s3_upload, "endpoint"):
                setattr(s3_upload, "endpoint", Config.S3_ENDPOINT)
            if hasattr(s3_upload, "force_path_style"):
                setattr(s3_upload, "force_path_style", Config.S3_FORCE_PATH_STYLE)
        except Exception:
            pass

        req = api.RoomCompositeEgressRequest(
            room_name=room_name,
            audio_only=True,
            file_outputs=[api.EncodedFileOutput(
                file_type=api.EncodedFileType.OGG,
                filepath=filepath,
                s3=s3_upload,
            )],
        )
        
        res = await lkapi.egress.start_room_composite_egress(req)
        egress_id = res.egress_id
        
        logger.info(f"✅ Started recording: {egress_id} -> {filepath}")
        return egress_id
        
    except Exception as e:
        logger.error(f"❌ Failed to start recording: {e}")
        return None

async def get_recording_metadata(egress_id: str) -> Optional[Dict[str, Any]]:
    """
    Get recording metadata from Egress
    
    Args:
        egress_id: Egress ID
    
    Returns:
        Recording metadata dict or None
    """
    try:
        lkapi = api.LiveKitAPI(
            url=Config.LIVEKIT_URL,
            api_key=Config.LIVEKIT_API_KEY,
            api_secret=Config.LIVEKIT_API_SECRET
        )
        
        egress_info = await lkapi.egress.get_egress_info(egress_id)
        
        if egress_info.status != api.EgressStatus.EGRESS_COMPLETE:
            logger.warning(f"⚠️ Egress {egress_id} not complete: {egress_info.status}")
            return None
        
        # Extract file info
        file_output = None
        if egress_info.file:
            file_output = egress_info.file
        elif egress_info.stream:
            # Stream output - would need different handling
            logger.warning("⚠️ Stream output not yet supported")
            return None
        
        if not file_output:
            return None
        
        base_meta = {
            'provider': 'livekit-egress',
            'storage': 's3',
            'bucket': Config.AWS_BUCKET_NAME,
            'object_path': file_output.filename,
            'mime_type': 'audio/ogg',
            'duration_seconds': int(egress_info.duration / 1_000_000_000),  # nanoseconds to seconds
            'size_bytes': file_output.size if hasattr(file_output, 'size') else None,
        }

        # If configured, mirror to Supabase Storage and return Supabase metadata
        try:
            bucket = Config.SUPABASE_RECORDINGS_BUCKET
            if bucket and Config.SUPABASE_URL and Config.SUPABASE_SERVICE_KEY:
                mirrored = await _mirror_to_supabase(
                    s3_bucket=base_meta['bucket'],
                    s3_key=base_meta['object_path'],
                    supabase_bucket=bucket,
                    supabase_key=base_meta['object_path']
                )
                if mirrored:
                    return {
                        **base_meta,
                        'storage': 'supabase',
                        'bucket': bucket,
                        'object_path': base_meta['object_path'],
                    }
        except Exception as e:
            logger.warning(f"⚠️ Failed to mirror recording to Supabase: {e}")

        return base_meta
        
    except Exception as e:
        logger.error(f"❌ Failed to get recording metadata: {e}")
        return None


async def _mirror_to_supabase(
    s3_bucket: str,
    s3_key: str,
    supabase_bucket: str,
    supabase_key: str,
) -> bool:
    """
    Download the recording from S3 and upload to Supabase Storage.
    Creates the bucket if it does not exist.
    """
    # Download from S3
    s3_client = boto3.client(
        's3',
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        region_name=Config.AWS_REGION,
    )
    file_buf = io.BytesIO()
    s3_client.download_fileobj(s3_bucket, s3_key, file_buf)
    file_buf.seek(0)

    # Supabase client
    supabase = get_supabase_client()

    # Ensure bucket exists
    try:
        buckets = supabase.storage.list_buckets()
        if not any(b.get('name') == supabase_bucket for b in buckets):
            supabase.storage.create_bucket(supabase_bucket, public=False)
    except Exception as e:
        logger.warning(f"⚠️ Could not verify/create Supabase bucket '{supabase_bucket}': {e}")

    # Upload
    try:
        resp = supabase.storage.from_(supabase_bucket).upload(
            path=supabase_key,
            file=file_buf.getvalue(),
            file_options={"contentType": "audio/ogg", "upsert": True},
        )
        return bool(resp)
    except Exception as e:
        logger.error(f"❌ Failed to upload recording to Supabase Storage: {e}")
        return False

