"""Nutrition tools for the CrocFit AI coach agent."""

from typing import Any, cast

import structlog
from langchain_core.runnables import RunnableConfig

from croc_fit_api.connectors.supabase import get_supabase_service_client

logger = structlog.get_logger(__name__)


async def get_nutrition_targets(config: RunnableConfig) -> dict[str, Any] | None:
    """Return the active nutrition targets for the authenticated user.

    Args:
        config: LangGraph runtime config — user_id read from configurable.

    Returns:
        Nutrition target dict or None if not configured.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    result = (
        client.table("nutrition_targets")
        .select("*")
        .eq("user_id", user_id)
        .eq("active", True)
        .limit(1)
        .execute()
    )
    return cast("dict[str, Any]", result.data[0]) if result.data else None


async def set_nutrition_targets(
    config: RunnableConfig,
    kcal: int,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
) -> dict[str, Any]:
    """Set or replace the active nutrition targets for the authenticated user.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        kcal: Daily calorie target.
        protein_g: Daily protein target in grams.
        carbs_g: Daily carbohydrates target in grams.
        fat_g: Daily fat target in grams.

    Returns:
        Updated nutrition target dict.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    # Deactivate previous targets
    client.table("nutrition_targets").update({"active": False}).eq("user_id", user_id).execute()
    payload: dict[str, Any] = {
        "user_id": user_id,
        "kcal": kcal,
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
        "active": True,
    }
    result = client.table("nutrition_targets").insert(payload).execute()
    logger.info("nutrition_targets_set", user_id=user_id, kcal=kcal)
    return cast("dict[str, Any]", result.data[0]) if result.data else {}


async def log_meal(
    config: RunnableConfig,
    date: str,
    description: str,
    source: str = "text",
) -> dict[str, Any]:
    """Log a meal entry for the authenticated user.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        date: ISO date string (YYYY-MM-DD).
        description: Free-text or AI-analysed meal description.
        source: "text" or "image".

    Returns:
        Created meal log dict.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    payload = {
        "user_id": user_id,
        "date": date,
        "description": description,
        "source": source,
    }
    result = client.table("meal_logs").insert(payload).execute()
    logger.info("meal_logged", user_id=user_id, date=date, source=source)
    return cast("dict[str, Any]", result.data[0]) if result.data else {}


async def get_meals(config: RunnableConfig, date: str) -> list[dict[str, Any]]:
    """Return all meal entries for a specific date.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        date: ISO date string (YYYY-MM-DD).

    Returns:
        List of meal log entries for the given date.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    result = (
        client.table("meal_logs")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", date)
        .order("created_at")
        .execute()
    )
    return cast("list[dict[str, Any]]", result.data or [])
