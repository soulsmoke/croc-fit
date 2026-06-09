"""Personal Records and load calculation endpoints for CrocFit API."""

from typing import Any, cast

import structlog
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

from croc_fit_api.connectors.supabase import get_supabase_service_client
from croc_fit_api.schemas.models import LoadCalculateRequest, PRCreate
from croc_fit_api.tools.prs import calculate_loads, list_prs, upsert_pr


def _cfg(user_id: str) -> dict:
    return {"configurable": {"user_id": user_id}}

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/prs", tags=["prs"])
loads_router = APIRouter(prefix="/loads", tags=["loads"])


@router.get("")
async def get_prs(user_id: str = Query(...)) -> list[dict[str, Any]]:
    """Return all personal records for the user."""
    return await list_prs(_cfg(user_id))  # type: ignore[return-value]


@router.post("", status_code=201)
async def create_pr(user_id: str = Query(...), body: PRCreate = Body(...)) -> dict[str, Any]:
    """Insert or update a personal record for an exercise."""
    return await upsert_pr(  # type: ignore[return-value]
        config=_cfg(user_id),
        exercise_name=body.exercise_name,
        weight_kg=body.weight_kg,
        unit=body.unit,
    )


class PRUpdate(BaseModel):
    """Partial update body for a PR."""

    weight_kg: float
    unit: str = "kg"


@router.patch("/{pr_id}", status_code=200)
async def update_pr(pr_id: str, body: PRUpdate) -> dict[str, Any]:
    """Update the weight of an existing personal record."""
    client = get_supabase_service_client()
    result = (
        client.table("personal_records")
        .update({"weight_kg": body.weight_kg, "unit": body.unit})
        .eq("id", pr_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"PR {pr_id} not found")
    return cast("dict[str, Any]", result.data[0])


@router.delete("/{pr_id}", status_code=204)
async def delete_pr(pr_id: str) -> None:
    """Delete a personal record by ID."""
    client = get_supabase_service_client()
    result = (
        client.table("personal_records")
        .delete()
        .eq("id", pr_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"PR {pr_id} not found")


@loads_router.post("/calculate")
async def calculate_load_table(user_id: str = Query(...), body: LoadCalculateRequest = Body(...)) -> dict[str, Any]:
    """Calculate training loads as percentages of the PR for an exercise.

    Returns a load table with safety disclaimer (REQ-025).
    """
    try:
        return await calculate_loads(  # type: ignore[return-value]
            config=_cfg(user_id),
            exercise_name=body.exercise_name,
            round_to_kg=body.round_to_kg,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
