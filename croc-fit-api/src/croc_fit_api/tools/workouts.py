"""Workout tools for the CrocFit AI coach agent."""

from typing import Any, cast

import structlog
from langchain_core.runnables import RunnableConfig

from croc_fit_api.connectors.supabase import get_supabase_service_client

logger = structlog.get_logger(__name__)

# Valid block_type values as defined by the DB CHECK constraint.
_VALID_BLOCK_TYPES = frozenset({"warm_up", "work", "cool_down", "accessory"})

# Map of common LLM-invented block types to the nearest valid value.
_BLOCK_TYPE_ALIASES: dict[str, str] = {
    "strength": "work",
    "wod": "work",
    "conditioning": "work",
    "metcon": "work",
    "weightlifting": "work",
    "gymnastics": "work",
    "skill": "work",
    "emom": "work",
    "amrap": "work",
    "for_time": "work",
    "warmup": "warm_up",
    "warm-up": "warm_up",
    "cooldown": "cool_down",
    "cool-down": "cool_down",
    "accessory_work": "accessory",
}


def _normalize_block_type(raw: str) -> str:
    """Map any block_type string to one of the four valid DB values.

    Accepts exact valid values, known aliases, and falls back to ``"work"``
    for any unrecognised input so the DB CHECK constraint is never violated.

    Args:
        raw: Block type string from the LLM (may be any string).

    Returns:
        One of ``"warm_up"``, ``"work"``, ``"cool_down"``, ``"accessory"``.
    """
    normalized = raw.strip().lower().replace(" ", "_")
    if normalized in _VALID_BLOCK_TYPES:
        return normalized
    mapped = _BLOCK_TYPE_ALIASES.get(normalized)
    if mapped:
        logger.info("block_type_aliased", raw=raw, mapped=mapped)
        return mapped
    logger.warning("block_type_unknown_fallback", raw=raw, fallback="work")
    return "work"


def _round_load(value: float, multiple: float = 2.5) -> float:
    """Round a load value to the nearest multiple (default 2.5 kg)."""
    return round(value / multiple) * multiple


async def _enrich_exercises_with_pr(session: dict[str, Any]) -> dict[str, Any]:
    """Fill in computed load_kg for exercises that have load_pct but no load_kg.

    Called after fetching a session from the DB. For each exercise where
    ``load_pct`` is set (or deducible from ``load_notes``) and ``load_kg`` is
    None, looks up the user's current PR for that exercise and computes the
    load on the fly (in memory — no DB write).

    Handles legacy exercises created before the ``load_pct`` column existed:
    those have ``load_pct=NULL`` but ``load_notes`` like "@ 80% 1RM".

    If no PR exists for an exercise, ``load_kg`` stays None and a
    ``load_pct_pending`` flag is set to True so the frontend can display a hint.

    Args:
        session: Full session dict with nested workout_blocks and workout_exercises.

    Returns:
        The same session dict, mutated in place with computed load_kg values.
    """
    import re

    _PCT_RE = re.compile(r"@\s*(\d+(?:\.\d+)?)\s*%", re.IGNORECASE)

    def _extract_pct(ex: dict[str, Any]) -> float | None:
        """Return load percentage from load_pct field or parse load_notes."""
        if ex.get("load_pct") is not None:
            return float(ex["load_pct"])
        notes: str = ex.get("load_notes") or ""
        m = _PCT_RE.search(notes)
        return float(m.group(1)) if m else None

    user_id: str = session.get("user_id", "")
    if not user_id:
        return session

    # Collect exercises that need a PR lookup (% known, load_kg missing)
    pending: list[tuple[dict[str, Any], float]] = []
    for block in session.get("workout_blocks", []):
        for ex in block.get("workout_exercises", []):
            if ex.get("load_kg") is None:
                pct = _extract_pct(ex)
                if pct is not None:
                    pending.append((ex, pct))

    if not pending:
        return session

    # Fetch all PRs for the user in one query
    client = get_supabase_service_client()
    prs_result = (
        client.table("personal_records")
        .select("exercise_name, weight_kg")
        .eq("user_id", user_id)
        .execute()
    )
    pr_map: dict[str, float] = {}
    for pr in prs_result.data or []:
        pr_map[pr["exercise_name"].strip().lower()] = float(pr["weight_kg"])

    from croc_fit_api.tools.prs import _normalize_exercise_name

    for ex, load_pct in pending:
        normalized = _normalize_exercise_name(ex.get("name", ""))
        pr_kg = pr_map.get(normalized)
        if pr_kg is None:
            # Try fuzzy match via normalized key
            for stored_name, stored_kg in pr_map.items():
                if _normalize_exercise_name(stored_name) == normalized:
                    pr_kg = stored_kg
                    break
        if pr_kg is not None:
            ex["load_kg"] = _round_load(pr_kg * load_pct / 100)
            ex["load_notes"] = f"@ {int(load_pct)}% 1RM ({pr_kg:.1f} kg PR)"
        else:
            ex["load_pct_pending"] = True  # frontend hint: PR not yet registered

    return session


async def list_workout_sessions(config: RunnableConfig, limit: int = 10) -> list[dict[str, Any]]:
    """Return the most recent workout sessions for the authenticated user.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        limit: Maximum number of sessions to return (default 10).

    Returns:
        List of workout session dicts ordered by scheduled_date descending.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    result = (
        client.table("workout_sessions")
        .select("*, workout_blocks(*, workout_exercises(*))")
        .eq("user_id", user_id)
        .order("scheduled_date", desc=True)
        .limit(limit)
        .execute()
    )
    return cast("list[dict[str, Any]]", result.data or [])


async def get_workout_session(session_id: str) -> dict[str, Any]:
    """Return a single workout session with blocks and exercises.

    The ``session_id`` MUST be a real UUID obtained from ``list_workout_sessions``.
    Never pass a placeholder string like ``"today_session_id"`` — always fetch
    the real ID first.

    Args:
        session_id: UUID of the workout session (from list_workout_sessions).

    Returns:
        Workout session dict with nested blocks and exercises.
        Returns ``{"error": "..."}`` if the session is not found or the ID is invalid.
    """
    try:
        client = get_supabase_service_client()
        result = (
            client.table("workout_sessions")
            .select("*, workout_blocks(*, workout_exercises(*))")
            .eq("id", session_id)
            .single()
            .execute()
        )
        if not result.data:
            return {
                "error": (
                    f"Workout session '{session_id}' not found. "
                    "Call list_workout_sessions first to get the real session ID."
                )
            }
        row: dict[str, Any] = cast("dict[str, Any]", result.data)
        return await _enrich_exercises_with_pr(row)
    except Exception as exc:
        logger.error("get_workout_session_error", session_id=session_id, error=str(exc))
        return {
            "error": (
                f"Failed to fetch session '{session_id}': {exc}. "
                "Call list_workout_sessions first to get the real UUID."
            )
        }


async def create_workout_session(
    config: RunnableConfig,
    title: str,
    scheduled_date: str,
    notes: str = "",
    blocks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Create a new workout session with optional structured blocks and exercises.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        title: Session title (e.g. "Monday Strength — Back Squat + Fran").
        scheduled_date: ISO date string (YYYY-MM-DD).
        notes: Optional session-level notes.
        blocks: Optional list of workout blocks. Each block is a dict with:
            - block_type: "warm_up" | "work" | "cool_down" | "accessory"
            - title: block name (e.g. "Warm-up", "Strength", "WOD", "Cool-down")
            - description: free text describing the block format (e.g. "AMRAP 20 min")
            - format: short format label (e.g. "5x3", "AMRAP 20'", "10 min")
            - notes: optional block-level notes
            - exercises: list of exercise dicts, each with:
                - name: exercise name
                - sets: number of sets (int, optional)
                - reps: reps scheme string (e.g. "5", "3-2-1", "AMRAP", "90 sec")
                - load_kg: load in kg (float, optional)
                - load_notes: e.g. "@ 70% 1RM" (optional)

    Returns:
        Created workout session dict with nested blocks and exercises.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()

    session_result = client.table("workout_sessions").insert({
        "user_id": user_id,
        "title": title,
        "scheduled_date": scheduled_date,
        "status": "planned",
        "notes": notes,
    }).execute()

    if not session_result.data:
        return {}

    session: dict[str, Any] = cast("dict[str, Any]", session_result.data[0])
    session_id: str = session["id"]

    if blocks:
        for pos, block in enumerate(blocks):
            block_result = client.table("workout_blocks").insert({
                "session_id": session_id,
                "block_type": _normalize_block_type(block.get("block_type", "work")),
                "title": block.get("title", ""),
                "description": block.get("description", ""),
                "format": block.get("format", ""),
                "notes": block.get("notes", ""),
                "position": pos,
            }).execute()

            if not block_result.data:
                continue

            block_id: str = cast("dict[str, Any]", block_result.data[0])["id"]
            exercises: list[dict[str, Any]] = block.get("exercises", [])

            if exercises:
                ex_rows = [
                    {
                        "block_id": block_id,
                        "name": ex.get("name", ""),
                        "sets": ex.get("sets"),
                        "reps": ex.get("reps", ""),
                        "load_kg": ex.get("load_kg"),
                        "load_pct": ex.get("load_pct"),
                        "load_notes": ex.get("load_notes", ""),
                        "position": ex_pos,
                    }
                    for ex_pos, ex in enumerate(exercises)
                ]
                client.table("workout_exercises").insert(ex_rows).execute()

    logger.info("workout_session_created", user_id=user_id, title=title, blocks=len(blocks or []))

    # Return full session with blocks
    full = (
        client.table("workout_sessions")
        .select("*, workout_blocks(*, workout_exercises(*))")
        .eq("id", session_id)
        .single()
        .execute()
    )
    return cast("dict[str, Any]", full.data) if full.data else session


async def add_workout_block(
    session_id: str,
    block_type: str,
    title: str,
    description: str = "",
    block_format: str = "",
    notes: str = "",
    exercises: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Add a new block (with exercises) to an existing workout session.

    Use this to append a block (e.g. a weightlifting section) to a session
    that was already created. Do NOT use ``create_workout_session`` — that
    creates a brand-new session from scratch.

    Required call order:
    1. Call ``list_workout_sessions`` to find today's session and its ``id``.
    2. Call ``add_workout_block`` with that real ``session_id``.

    Args:
        session_id: Real UUID of the existing workout session.
        block_type: One of "warm_up", "work", "cool_down", "accessory".
        title: Block title (e.g. "Weightlifting", "Strength").
        description: Free-text description of the block format (e.g. "Every 90\" x 12 sets").
        format: Short format label (e.g. "every 90\"", "AMRAP 20'").
        notes: Optional block-level notes.
        exercises: List of exercise dicts, each with:
            - name: exercise name (str, required)
            - sets: number of sets (int, optional)
            - reps: reps scheme string, e.g. "3", "2+2", "1+1" (optional)
            - load_kg: load in kg (float, optional — omit if using load_pct)
            - load_pct: percentage of 1RM (float, optional — e.g. 80.0 for 80%)
            - load_notes: e.g. "peso libero" (optional)

    Returns:
        Created block dict with nested exercises.
        Returns ``{"error": "..."}`` if the session is not found.
    """
    try:
        client = get_supabase_service_client()

        # Determine next position
        existing = (
            client.table("workout_blocks")
            .select("position")
            .eq("session_id", session_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
        )
        next_pos = (cast("list[dict[str, Any]]", existing.data or [{}])[0].get("position", -1) or -1) + 1

        block_result = client.table("workout_blocks").insert({
            "session_id": session_id,
            "block_type": _normalize_block_type(block_type),
            "title": title,
            "description": description,
            "format": block_format,
            "notes": notes,
            "position": next_pos,
        }).execute()

        if not block_result.data:
            return {"error": f"Failed to create block in session '{session_id}'."}

        block: dict[str, Any] = cast("dict[str, Any]", block_result.data[0])
        block_id: str = block["id"]

        if exercises:
            ex_rows = [
                {
                    "block_id": block_id,
                    "name": ex.get("name", ""),
                    "sets": ex.get("sets"),
                    "reps": ex.get("reps", ""),
                    "load_kg": ex.get("load_kg"),
                    "load_pct": ex.get("load_pct"),
                    "load_notes": ex.get("load_notes", ""),
                    "position": pos,
                }
                for pos, ex in enumerate(exercises)
            ]
            ex_result = client.table("workout_exercises").insert(ex_rows).execute()
            block["workout_exercises"] = ex_result.data or []

        logger.info(
            "workout_block_added",
            session_id=session_id,
            block_id=block_id,
            title=title,
            exercises=len(exercises or []),
        )
        return block
    except Exception as exc:
        logger.error("add_workout_block_error", session_id=session_id, error=str(exc))
        return {"error": f"Failed to add block to session '{session_id}': {exc}."}


async def complete_workout_session(session_id: str, rpe: int | None = None, feedback: str = "") -> dict[str, Any]:
    """Mark a workout session as completed with optional RPE and feedback.

    Args:
        session_id: UUID of the session to complete.
        rpe: Rate of perceived exertion (1-10).
        feedback: Post-workout notes or comments.

    Returns:
        Updated workout session dict.
    """
    client = get_supabase_service_client()
    payload: dict[str, str | int] = {"status": "completed", "feedback": feedback}
    if rpe is not None:
        payload["rpe"] = rpe
    result = (
        client.table("workout_sessions")
        .update(payload)
        .eq("id", session_id)
        .execute()
    )
    logger.info("workout_session_completed", session_id=session_id, rpe=rpe)
    return cast("dict[str, Any]", result.data[0]) if result.data else {}


async def update_exercise(
    exercise_id: str,
    load_kg: float | None = None,
    load_notes: str | None = None,
    reps: str | None = None,
    sets: int | None = None,
    ex_notes: str | None = None,
) -> dict[str, Any]:
    """Update a specific exercise inside a workout session.

    IMPORTANT — ``exercise_id`` MUST be a real UUID from the database.
    NEVER call this with a placeholder like ``"clean_and_jerk_id"``.

    Required call order before invoking this tool:
    1. Call ``list_workout_sessions`` to find today's session and its ``id``.
    2. Call ``get_workout_session(session_id)`` to get the exercise list.
    3. Find the target exercise in ``workout_blocks[].workout_exercises[].id``.
    4. Only then call ``update_exercise`` with that real UUID.

    Args:
        exercise_id: Real UUID of the workout exercise (from get_workout_session).
        load_kg: Load in kilograms (e.g. 70.0 for 70 kg).
        load_notes: Human-readable load annotation, e.g. "@ 70% 1RM" (optional).
        reps: Reps scheme string, e.g. "5", "3-2-1", "AMRAP" (optional).
        sets: Number of sets (optional).
        ex_notes: Per-exercise notes (optional).

    Returns:
        Updated workout exercise dict.
        Returns ``{"error": "..."}`` if the exercise is not found or the ID is invalid.
    """
    try:
        payload = {
            k: v
            for k, v in {
                "load_kg": load_kg,
                "load_notes": load_notes,
                "reps": reps,
                "sets": sets,
                "ex_notes": ex_notes,
            }.items()
            if v is not None
        }
        if not payload:
            return {
                "error": (
                    "No fields provided to update. "
                    "Pass at least one of: load_kg, load_notes, reps, sets, ex_notes."
                )
            }
        client = get_supabase_service_client()
        result = (
            client.table("workout_exercises")
            .update(payload)
            .eq("id", exercise_id)
            .execute()
        )
        if not result.data:
            return {
                "error": (
                    f"Exercise '{exercise_id}' not found. "
                    "Call get_workout_session with the real session UUID to retrieve valid exercise IDs."
                )
            }
        logger.info("exercise_updated", exercise_id=exercise_id, fields=list(payload.keys()))
        return cast("dict[str, Any]", result.data[0])
    except Exception as exc:
        logger.error("update_exercise_error", exercise_id=exercise_id, error=str(exc))
        return {
            "error": (
                f"Failed to update exercise '{exercise_id}': {exc}. "
                "Make sure exercise_id is a real UUID from get_workout_session."
            )
        }



async def get_calendar(config: RunnableConfig, from_date: str, to_date: str) -> list[dict[str, Any]]:
    """Return planned and completed sessions within a date range.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        from_date: Start date ISO string (YYYY-MM-DD).
        to_date: End date ISO string (YYYY-MM-DD).

    Returns:
        List of workout sessions in the requested range.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    result = (
        client.table("workout_sessions")
        .select("id, title, scheduled_date, status, rpe")
        .eq("user_id", user_id)
        .gte("scheduled_date", from_date)
        .lte("scheduled_date", to_date)
        .order("scheduled_date")
        .execute()
    )
    return cast("list[dict[str, Any]]", result.data or [])
