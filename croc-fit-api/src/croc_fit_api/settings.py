"""Application settings for CrocFit Coach AI backend."""

from functools import lru_cache
from typing import Literal

from agent_core import BaseAgentSettings
from pydantic import Field


class Settings(BaseAgentSettings):
    """Runtime configuration for CrocFit Coach AI.

    Extends BaseAgentSettings with Supabase, upload, and CORS fields.
    LLM provider fields (llm_provider, litellm_model, litellm_api_base,
    ollama_model, azure_foundry_*) are inherited from BaseAgentSettings.
    """

    # Override to allow 'groq' as additional provider
    llm_provider: Literal["ollama", "azure_foundry", "litellm", "groq"] = Field(default="litellm")

    # Supabase
    supabase_url: str = Field(default="")
    supabase_anon_key: str = Field(default="")
    supabase_service_role_key: str = Field(default="")

    # LiteLLM API key (not in base — provider-specific secret)
    litellm_api_key: str = Field(default="")

    # Groq
    groq_api_key: str = Field(default="")
    groq_model: str = Field(default="llama-3.3-70b-versatile")

    # Debug / docs UI
    debug: bool = Field(default=False)

    # Upload limits
    max_upload_bytes: int = Field(default=10 * 1024 * 1024)  # 10 MB
    allowed_mime_types: list[str] = Field(
        default=["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]
    )

    # CORS — extra origins beyond agent-core defaults
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://localhost:8081"])


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
