"""Personal Records and load calculation tools for the CrocFit AI coach agent."""

from typing import Any, cast

import structlog
from langchain_core.runnables import RunnableConfig

from croc_fit_api.connectors.supabase import get_supabase_service_client

logger = structlog.get_logger(__name__)

# Standard barbell load percentages used in CrossFit programming
LOAD_PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]


def _normalize_exercise_name(name: str) -> str:
    """Normalize exercise name for fuzzy matching.

    Converts snake_case, hyphenated, and special-character variants to a
    comparable lowercase form so that e.g. "clean_and_jerk" matches "Clean & Jerk".

    Args:
        name: Raw exercise name string from user or LLM.

    Returns:
        Normalized lowercase string suitable for comparison.
    """
    name = name.replace("_", " ").replace("-", " ")
    name = name.replace("&", "and")
    return " ".join(name.lower().split())


async def list_prs(config: RunnableConfig) -> list[dict[str, Any]]:
    """Return all personal records for the authenticated user.

    Args:
        config: LangGraph runtime config — user_id read from configurable.

    Returns:
        List of personal record dicts ordered by exercise name.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    result = (
        client.table("personal_records")
        .select("*")
        .eq("user_id", user_id)
        .order("exercise_name")
        .execute()
    )
    return cast("list[dict[str, Any]]", result.data or [])


async def _get_pr(user_id: str, exercise_name: str) -> dict[str, Any] | None:
    """Return the current PR for a specific exercise (internal helper).

    Performs a two-step lookup:
    1. Fast path: case-insensitive exact ilike match.
    2. Fuzzy path: normalizes both the input name and all stored PR names
       (replaces ``_``, ``-``, ``&`` → ``and``, lowercase) and does equality
       comparison.  This handles LLM snake_case inputs like ``clean_and_jerk``
       matching a stored PR named ``Clean & Jerk``.

    Args:
        user_id: Supabase user UUID.
        exercise_name: Name of the exercise as provided by the LLM (may be
            snake_case or contain special characters).

    Returns:
        Personal record dict or None if not found.
    """
    client = get_supabase_service_client()

    # Fast path: ilike exact match (handles case differences)
    result = (
        client.table("personal_records")
        .select("*")
        .eq("user_id", user_id)
        .ilike("exercise_name", exercise_name)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return cast("dict[str, Any]", result.data[0])

    # Fuzzy path: normalize input and compare against all stored PR names
    normalized_input = _normalize_exercise_name(exercise_name)
    all_result = (
        client.table("personal_records")
        .select("*")
        .eq("user_id", user_id)
        .order("recorded_at", desc=True)
        .execute()
    )
    if not all_result.data:
        return None

    for pr in all_result.data:
        if _normalize_exercise_name(pr.get("exercise_name", "")) == normalized_input:
            logger.info(
                "pr_fuzzy_match",
                input_name=exercise_name,
                matched_name=pr["exercise_name"],
            )
            return cast("dict[str, Any]", pr)

    return None


async def upsert_pr(
    config: RunnableConfig,
    exercise_name: str,
    weight_kg: float,
    unit: str = "kg",
) -> dict[str, Any]:
    """Insert or update a personal record for an exercise.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        exercise_name: Canonical exercise name (e.g. "Back Squat").
        weight_kg: PR weight in kilograms.
        unit: Display unit ("kg" or "lbs").

    Returns:
        Upserted personal record dict.
    """
    user_id: str = config["configurable"]["user_id"]
    client = get_supabase_service_client()
    payload: dict[str, Any] = {
        "user_id": user_id,
        "exercise_name": exercise_name,
        "weight_kg": weight_kg,
        "unit": unit,
    }
    result = (
        client.table("personal_records")
        .upsert(payload, on_conflict="user_id,exercise_name")
        .execute()
    )
    logger.info("pr_upserted", user_id=user_id, exercise=exercise_name, weight=weight_kg)
    return cast("dict[str, Any]", result.data[0]) if result.data else {}


async def calculate_loads(
    config: RunnableConfig,
    exercise_name: str,
    round_to_kg: float = 2.5,
) -> dict[str, Any]:
    """Calculate training loads as percentages of the PR for an exercise.

    Includes a safety disclaimer as required by REQ-025.
    Performs fuzzy name matching so that LLM variants like ``clean_and_jerk``
    correctly resolve to a stored PR named ``Clean & Jerk``.

    Args:
        config: LangGraph runtime config — user_id read from configurable.
        exercise_name: Exercise to calculate loads for. May be snake_case or
            contain special characters — fuzzy matching is applied automatically.
        round_to_kg: Round loads to nearest multiple (default 2.5 kg).

    Returns:
        Dict with exercise_name, pr_weight_kg, unit, and loads list
        (percentage, exact weight, rounded weight).
        Returns ``{"error": "..."}`` if no PR exists for the exercise instead
        of raising — this prevents LangGraph from crashing on tool errors.
    """
    try:
        user_id: str = config["configurable"]["user_id"]
        pr = await _get_pr(user_id, exercise_name)
        if not pr:
            return {
                "error": (
                    f"No PR found for '{exercise_name}'. "
                    "Call list_prs first to see the exact exercise names stored in the database."
                )
            }

        pr_kg: float = pr["weight_kg"]
        unit: str = pr.get("unit", "kg")
        resolved_name: str = pr["exercise_name"]  # use the canonical DB name

        def _round(val: float) -> float:
            return round(val / round_to_kg) * round_to_kg

        loads = [
            {"percentage": pct, "weight": pr_kg * pct / 100, "rounded": _round(pr_kg * pct / 100)}
            for pct in LOAD_PERCENTAGES
        ]

        return {
            "exercise_name": resolved_name,
            "pr_weight_kg": pr_kg,
            "unit": unit,
            "loads": loads,
            "disclaimer": (
                "These loads are calculated from your PR. "
                "Always warm up properly and adjust based on how you feel today. "
                "In case of pain or discomfort, stop and consult a professional."
            ),
        }
    except Exception as exc:
        logger.error("calculate_loads_error", exercise=exercise_name, error=str(exc))
        return {"error": f"Failed to calculate loads: {exc}"}
