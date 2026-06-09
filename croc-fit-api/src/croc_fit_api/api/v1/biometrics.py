"""Biometric tracking endpoints for CrocFit API."""

from typing import Any

import structlog
from fastapi import APIRouter, Body, Query

from croc_fit_api.schemas.models import BiometricEntryCreate
from croc_fit_api.tools.biometrics import get_biometric_trend, log_biometrics


def _cfg(user_id: str) -> dict:
    return {"configurable": {"user_id": user_id}}

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/biometrics", tags=["biometrics"])


@router.get("")
async def get_biometrics(
    user_id: str = Query(...),
    days: int = Query(default=7, ge=1, le=90),
) -> list[dict[str, Any]]:
    """Return biometric trend data for the last N days."""
    return await get_biometric_trend(_cfg(user_id), days=days)  # type: ignore[return-value]


@router.post("", status_code=201)
async def log_biometric(user_id: str = Query(...), body: BiometricEntryCreate = Body(...)) -> dict[str, Any]:
    """Insert or update a daily biometric entry."""
    return await log_biometrics(  # type: ignore[return-value]
        config=_cfg(user_id),
        date=str(body.date),
        weight_kg=body.weight_kg,
        sleep_hours=body.sleep_hours,
        readiness=body.readiness,
        resting_hr=body.resting_hr,
        hrv=body.hrv,
    )
