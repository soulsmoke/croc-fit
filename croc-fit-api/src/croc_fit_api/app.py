"""FastAPI application factory for CrocFit Coach AI."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from croc_fit_api.api.v1.router import api_v1_router
from croc_fit_api.errors.handlers import register_exception_handlers
from croc_fit_api.settings import get_settings

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan: startup and shutdown hooks."""
    settings = get_settings()
    _model_log = {
        "ollama": settings.ollama_model,
        "azure_foundry": settings.azure_foundry_model,
        "litellm": settings.litellm_model,
        "groq": settings.groq_model,
    }.get(settings.llm_provider, settings.litellm_model)
    logger.info("croc_fit_api_starting", env=settings.app_env, provider=settings.llm_provider, model=_model_log)
    yield
    logger.info("croc_fit_api_stopping")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        Configured FastAPI instance with all routers and middleware.
    """
    settings = get_settings()

    app = FastAPI(
        title="CrocFit Coach AI API",
        version="0.1.0",
        description="Backend for CrocFit — AI-powered CrossFit coaching assistant.",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_v1_router)
    register_exception_handlers(app)

    return app
