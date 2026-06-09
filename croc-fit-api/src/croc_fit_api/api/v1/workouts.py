"""Workout session and calendar endpoints for CrocFit API."""

from datetime import UTC
from typing import Any, Literal, cast

import structlog
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

from croc_fit_api.connectors.supabase import get_supabase_service_client
from croc_fit_api.schemas.models import WorkoutSessionComplete, WorkoutSessionCreate
from croc_fit_api.tools.workouts import (
    complete_workout_session,
    create_workout_session,
    get_calendar,
    get_workout_session,
    list_workout_sessions,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/workouts", tags=["workouts"])
calendar_router = APIRouter(prefix="/calendar", tags=["calendar"])


def _cfg(user_id: str) -> dict:
    return {"configurable": {"user_id": user_id}}


@calendar_router.get("")
async def get_calendar_view(
    user_id: str = Query(...),
    from_date: str = Query(...),
    to_date: str = Query(...),
) -> list[dict[str, Any]]:
    """Return planned and completed sessions for a date range."""
    return await get_calendar(_cfg(user_id), from_date, to_date)  # type: ignore[return-value]


@router.get("")
async def list_sessions(
    user_id: str = Query(...),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[dict[str, Any]]:
    """Return the most recent workout sessions for the user."""
    return await list_workout_sessions(_cfg(user_id), limit=limit)  # type: ignore[return-value]


@router.get("/{session_id}")
async def get_session(session_id: str) -> dict[str, Any]:
    """Return a single workout session with nested blocks and exercises."""
    try:
        return await get_workout_session(session_id)  # type: ignore[return-value]
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("", status_code=201)
async def create_session(user_id: str = Query(...), body: WorkoutSessionCreate = Body(...)) -> dict[str, Any]:
    """Create a new planned workout session with optional structured blocks."""
    return await create_workout_session(  # type: ignore[return-value]
        config=_cfg(user_id),
        title=body.title,
        scheduled_date=str(body.scheduled_date),
        notes=body.notes,
        blocks=[b.model_dump() for b in body.blocks] if body.blocks else None,
    )


@router.patch("/{session_id}")
async def update_session(session_id: str, body: WorkoutSessionCreate) -> dict[str, Any]:
    """Update session title, date or notes."""
    client = get_supabase_service_client()
    result = (
        client.table("workout_sessions")
        .update({
            "title": body.title,
            "scheduled_date": str(body.scheduled_date),
            "notes": body.notes,
        })
        .eq("id", session_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    row: dict[str, Any] = cast("dict[str, Any]", result.data[0])
    return row


@router.post("/{session_id}/complete")
async def complete_session(session_id: str, body: WorkoutSessionComplete) -> dict[str, Any]:
    """Mark a workout session as completed with optional RPE and feedback."""
    return await complete_workout_session(session_id, rpe=body.rpe, feedback=body.feedback)  # type: ignore[return-value]


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str) -> None:
    """Delete a workout session and all its blocks and exercises."""
    client = get_supabase_service_client()
    result = (
        client.table("workout_sessions")
        .delete()
        .eq("id", session_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")


exercises_router = APIRouter(prefix="/exercises", tags=["exercises"])


@exercises_router.patch("/{exercise_id}/complete")
async def toggle_exercise_complete(
    exercise_id: str,
    completed: bool = Body(..., embed=True),
    ex_notes: str = Body("", embed=True),
) -> dict[str, Any]:
    """Toggle an exercise as completed/uncompleted and optionally update notes."""
    from datetime import datetime

    client = get_supabase_service_client()
    payload: dict[str, Any] = {
        "completed": completed,
        "ex_notes": ex_notes,
        "completed_at": datetime.now(tz=UTC).isoformat() if completed else None,
    }
    result = (
        client.table("workout_exercises")
        .update(payload)
        .eq("id", exercise_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found")
    return cast("dict[str, Any]", result.data[0])


@exercises_router.patch("/{exercise_id}/notes")
async def update_exercise_notes(
    exercise_id: str,
    ex_notes: str = Body(..., embed=True),
) -> dict[str, Any]:
    """Update per-exercise notes."""
    client = get_supabase_service_client()
    result = (
        client.table("workout_exercises")
        .update({"ex_notes": ex_notes})
        .eq("id", exercise_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found")
    return cast("dict[str, Any]", result.data[0])


class ExerciseUpdate(BaseModel):
    """Partial update for a workout exercise."""

    model_config = {"extra": "forbid"}

    reps: str | None = None
    sets: int | None = None
    load_kg: float | None = None
    load_notes: str | None = None
    ex_notes: str | None = None


@exercises_router.patch("/{exercise_id}")
async def update_exercise(exercise_id: str, body: ExerciseUpdate) -> dict[str, Any]:
    """Update reps, sets, load_kg, load_notes or ex_notes for an exercise."""
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=422, detail="No fields to update")
    client = get_supabase_service_client()
    result = (
        client.table("workout_exercises")
        .update(payload)
        .eq("id", exercise_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found")
    return cast("dict[str, Any]", result.data[0])


class ExerciseCreate(BaseModel):
    """New exercise to add to a block."""

    block_id: str
    name: str
    sets: int | None = None
    reps: str = ""
    load_kg: float | None = None
    load_pct: float | None = None
    load_notes: str = ""
    ex_notes: str = ""


@exercises_router.post("", status_code=201)
async def add_exercise(body: ExerciseCreate) -> dict[str, Any]:
    """Add a new exercise to an existing block."""
    client = get_supabase_service_client()
    # Determine next position
    existing = (
        client.table("workout_exercises")
        .select("position")
        .eq("block_id", body.block_id)
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    next_pos = (existing.data[0]["position"] + 1) if existing.data else 0
    payload: dict[str, Any] = {
        "block_id": body.block_id,
        "name": body.name,
        "sets": body.sets,
        "reps": body.reps,
        "load_kg": body.load_kg,
        "load_pct": body.load_pct,
        "load_notes": body.load_notes,
        "ex_notes": body.ex_notes,
        "completed": False,
        "position": next_pos,
    }
    result = client.table("workout_exercises").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create exercise")
    return cast("dict[str, Any]", result.data[0])


@exercises_router.delete("/{exercise_id}", status_code=204)
async def delete_exercise(exercise_id: str) -> None:
    """Delete an exercise from a block."""
    client = get_supabase_service_client()
    result = (
        client.table("workout_exercises")
        .delete()
        .eq("id", exercise_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Exercise {exercise_id} not found")


# ── Blocks ────────────────────────────────────────────────────────────────────

blocks_router = APIRouter(prefix="/blocks", tags=["blocks"])


class BlockCreate(BaseModel):
    """New block to add to a session."""

    session_id: str
    block_type: Literal["warm_up", "work", "cool_down", "accessory"] = "work"
    title: str = ""
    description: str = ""
    format: str = ""
    notes: str = ""


class BlockUpdate(BaseModel):
    """Partial update for a workout block."""

    block_type: Literal["warm_up", "work", "cool_down", "accessory"] | None = None
    title: str | None = None
    description: str | None = None
    format: str | None = None
    notes: str | None = None


@blocks_router.post("", status_code=201)
async def add_block(body: BlockCreate) -> dict[str, Any]:
    """Add a new empty block to an existing session."""
    client = get_supabase_service_client()
    existing = (
        client.table("workout_blocks")
        .select("position")
        .eq("session_id", body.session_id)
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    next_pos = (existing.data[0]["position"] + 1) if existing.data else 0
    payload: dict[str, Any] = {
        "session_id": body.session_id,
        "block_type": body.block_type,
        "title": body.title,
        "description": body.description,
        "format": body.format,
        "notes": body.notes,
        "position": next_pos,
    }
    result = client.table("workout_blocks").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create block")
    row = cast("dict[str, Any]", result.data[0])
    row["workout_exercises"] = []
    return row


@blocks_router.patch("/{block_id}")
async def update_block(block_id: str, body: BlockUpdate) -> dict[str, Any]:
    """Update title, type, description, format or notes of a block."""
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=422, detail="No fields to update")
    client = get_supabase_service_client()
    result = (
        client.table("workout_blocks")
        .update(payload)
        .eq("id", block_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Block {block_id} not found")
    return cast("dict[str, Any]", result.data[0])


@blocks_router.delete("/{block_id}", status_code=204)
async def delete_block(block_id: str) -> None:
    """Delete a block and all its exercises."""
    client = get_supabase_service_client()
    result = (
        client.table("workout_blocks")
        .delete()
        .eq("id", block_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Block {block_id} not found")
