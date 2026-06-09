"""Biometric tracking tools for the CrocFit AI coach agent."""

from typing import Any, cast

import structlog
from langchain_core.runnables import RunnableConfig

from croc_fit_api.connectors.supabase import get_supabase_service_client

logger = structlog.get_logger(__name__)


async def log_biometrics(
    config: RunnableConfig,
    date: str,
    weight_kg: float | None = None,
    sleep_hours: float | None = None,
    readiness: int | None = None,
    resting_hr: int | None = None,
    hrv: float | None = None,
) -> dict[str, Any]:
    """Insert or update a daily biometric entry for the authenticated user.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        date: ISO date string (YYYY-MM-DD).
        weight_kg: Body weight in kg.
        sleep_hours: Hours of sleep.
        readiness: Perceived readiness/energy (1-10).
        resting_hr: Resting heart rate (bpm).
        hrv: Heart rate variability (ms).

    Returns:
        Upserted biometric entry dict.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    payload: dict[str, str | float | int] = {"user_id": user_id, "date": date}
    if weight_kg is not None:
        payload["weight_kg"] = weight_kg
    if sleep_hours is not None:
        payload["sleep_hours"] = sleep_hours
    if readiness is not None:
        payload["readiness"] = readiness
    if resting_hr is not None:
        payload["resting_hr"] = resting_hr
    if hrv is not None:
        payload["hrv"] = hrv

    result = (
        client.table("biometric_entries")
        .upsert(payload, on_conflict="user_id,date")
        .execute()
    )
    logger.info("biometrics_logged", user_id=user_id, date=date)
    return cast("dict[str, Any]", result.data[0]) if result.data else {}


async def get_biometric_trend(config: RunnableConfig, days: int = 7) -> list[dict[str, Any]]:
    """Return biometric entries for the last N days.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        days: Number of days to look back (7 or 30).

    Returns:
        List of biometric entries ordered by date ascending.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    result = (
        client.table("biometric_entries")
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(days)
        .execute()
    )
    entries: list[dict[str, Any]] = list(reversed(cast("list[dict[str, Any]]", result.data or [])))
    return entries


async def get_biometric_insight(config: RunnableConfig) -> dict[str, Any]:
    """Return a structured summary of the last 7 and 30 day biometric trends.

    Args:
        config: LangGraph runtime config — user_id read from configurable.

    Returns:
        Dict with trend_7d and trend_30d lists for downstream AI analysis.
    """
    trend_7d = await get_biometric_trend(config, days=7)
    trend_30d = await get_biometric_trend(config, days=30)
    return {"trend_7d": trend_7d, "trend_30d": trend_30d}
