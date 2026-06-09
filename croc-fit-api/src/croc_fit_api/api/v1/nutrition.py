"""Nutrition endpoints for CrocFit API."""

from typing import Any

import structlog
from fastapi import APIRouter, Body, Query

from croc_fit_api.schemas.models import MealLogCreate, NutritionTargetUpdate
from croc_fit_api.tools.nutrition import get_meals, get_nutrition_targets, log_meal, set_nutrition_targets


def _cfg(user_id: str) -> dict:
    return {"configurable": {"user_id": user_id}}

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/nutrition", tags=["nutrition"])
meals_router = APIRouter(prefix="/meals", tags=["meals"])


@router.get("/targets")
async def get_targets(user_id: str = Query(...)) -> dict[str, Any]:
    """Return the active nutrition targets for the user."""
    targets = await get_nutrition_targets(_cfg(user_id))
    return targets or {}  # type: ignore[return-value]


@router.put("/targets")
async def update_targets(user_id: str = Query(...), body: NutritionTargetUpdate = Body(...)) -> dict[str, Any]:
    """Set or replace the active nutrition targets."""
    return await set_nutrition_targets(  # type: ignore[return-value]
        config=_cfg(user_id),
        kcal=body.kcal,
        protein_g=body.protein_g,
        carbs_g=body.carbs_g,
        fat_g=body.fat_g,
    )


@meals_router.post("", status_code=201)
async def create_meal(user_id: str = Query(...), body: MealLogCreate = Body(...)) -> dict[str, Any]:
    """Log a meal entry."""
    return await log_meal(  # type: ignore[return-value]
        config=_cfg(user_id),
        date=str(body.date),
        description=body.description,
        source=body.source,
    )


@meals_router.get("")
async def get_meals_for_date(
    user_id: str = Query(...),
    date: str = Query(...),
) -> list[dict[str, Any]]:
    """Return meal entries for a specific date."""
    return await get_meals(_cfg(user_id), date)  # type: ignore[return-value]
