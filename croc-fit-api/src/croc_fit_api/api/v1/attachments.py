"""Attachment upload endpoint for CrocFit API."""

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from croc_fit_api.connectors.supabase import get_supabase_service_client
from croc_fit_api.settings import get_settings

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/attachments", tags=["attachments"])

STORAGE_BUCKET = "attachments"


@router.post("/upload", status_code=201)
async def upload_attachment(
    user_id: str = Query(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Upload an image or PDF attachment and store metadata in the database.

    Validates MIME type and file size server-side (NFR-004).
    Logs the upload event for audit purposes (NFR-005).

    Args:
        user_id: Supabase user UUID (from query param).
        file: Multipart upload file (image or PDF).

    Returns:
        Attachment metadata dict with URL.

    Raises:
        HTTPException: 400 if MIME type or size is invalid.
    """
    settings = get_settings()

    # Validate content type
    content_type = file.content_type or ""
    if content_type not in settings.allowed_mime_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Allowed: {settings.allowed_mime_types}",
        )

    # Read and validate size
    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        max_mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {max_mb} MB")

    attachment_id = str(uuid.uuid4())
    filename = file.filename or f"{attachment_id}"
    storage_path = f"{user_id}/{attachment_id}/{filename}"

    client = get_supabase_service_client()

    # Upload to Supabase Storage
    try:
        client.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": content_type},
        )
    except Exception as exc:
        logger.exception("storage_upload_failed", user_id=user_id, filename=filename)
        raise HTTPException(status_code=500, detail="Storage upload failed") from exc

    # Get public URL
    url_response = client.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)

    # Persist metadata
    now = datetime.now(UTC).isoformat()
    record = {
        "id": attachment_id,
        "user_id": user_id,
        "filename": filename,
        "mime_type": content_type,
        "storage_path": storage_path,
        "url": url_response,
        "created_at": now,
    }
    result = client.table("attachments").insert(record).execute()

    logger.info("attachment_uploaded", user_id=user_id, attachment_id=attachment_id, mime=content_type)
    return result.data[0] if result.data else record  # type: ignore[return-value]
