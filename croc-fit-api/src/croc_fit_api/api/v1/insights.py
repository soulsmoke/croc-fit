"""Insights summary endpoint for CrocFit API."""

from typing import Any

import structlog
from fastapi import APIRouter, Query

from croc_fit_api.tools.biometrics import get_biometric_insight
from croc_fit_api.tools.workouts import list_workout_sessions


def _cfg(user_id: str) -> dict:
    return {"configurable": {"user_id": user_id}}

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/summary")
async def get_summary(user_id: str = Query(...)) -> dict[str, Any]:
    """Return a structured summary of the last 7 days for AI analysis.

    Aggregates recent workouts and biometric trends for the dashboard.
    """
    recent_workouts = await list_workout_sessions(_cfg(user_id), limit=7)
    biometric_insight = await get_biometric_insight(_cfg(user_id))

    return {
        "recent_workouts": recent_workouts,
        "biometric_trend_7d": biometric_insight["trend_7d"],
        "biometric_trend_30d": biometric_insight["trend_30d"],
    }
