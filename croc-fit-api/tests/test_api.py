"""Integration tests for CrocFit API HTTP endpoints."""

import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    """GET /api/v1/health returns 200 with status ok."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_ready_endpoint(client: AsyncClient) -> None:
    """GET /api/v1/ready returns 200 with status ok."""
    response = await client.get("/api/v1/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ── Attachment upload — validation tests ─────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_attachment_rejects_unsupported_mime(client: AsyncClient) -> None:
    """POST /attachments/upload returns 400 when MIME type is not allowed."""
    data = b"fake video content"
    response = await client.post(
        "/api/v1/attachments/upload",
        params={"user_id": "user-test-1"},
        files={"file": ("video.mp4", io.BytesIO(data), "video/mp4")},
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_attachment_rejects_oversized_file(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /attachments/upload returns 400 when file exceeds max_upload_bytes."""
    from pydantic_settings import SettingsConfigDict

    from croc_fit_api.settings import Settings

    class _SmallLimitSettings(Settings):
        model_config = SettingsConfigDict(env_file=None, extra="ignore")
        supabase_url: str = "http://localhost:54321"
        supabase_anon_key: str = "test-anon-key"
        supabase_service_role_key: str = "test-service-key"
        max_upload_bytes: int = 10  # 10 bytes limit

    monkeypatch.setattr("croc_fit_api.api.v1.attachments.get_settings", lambda: _SmallLimitSettings())

    big_data = b"x" * 100  # 100 bytes > 10 bytes limit
    response = await client.post(
        "/api/v1/attachments/upload",
        params={"user_id": "user-test-1"},
        files={"file": ("photo.jpg", io.BytesIO(big_data), "image/jpeg")},
    )
    assert response.status_code == 400
    assert "File too large" in response.json()["detail"]
