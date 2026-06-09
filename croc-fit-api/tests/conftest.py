"""Shared test fixtures for CrocFit API tests."""

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic_settings import SettingsConfigDict

from croc_fit_api.app import create_app
from croc_fit_api.settings import Settings


class _TestSettings(Settings):
    """Isolated settings — no .env.local read during tests."""

    model_config = SettingsConfigDict(env_file=None, extra="ignore")
    supabase_url: str = "http://localhost:54321"
    supabase_anon_key: str = "test-anon-key"
    supabase_service_role_key: str = "test-service-key"
    debug: bool = True


@pytest.fixture()
def test_settings() -> _TestSettings:
    """Return isolated test settings."""
    return _TestSettings()


@pytest.fixture()
async def client() -> AsyncClient:  # type: ignore[misc]
    """Return an async HTTP test client."""
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
