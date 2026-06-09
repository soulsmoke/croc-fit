"""CrocFit Coach AI — agent wiring with agent-core.

This module provides build_agent() which wires the FitnessCoachTemplate
with all domain tools. Used by server.py for the SSE chat endpoint.
"""

from datetime import date
from typing import Any

from langgraph.checkpoint.memory import MemorySaver


def _build_system_prompt_suffix() -> str:
    today = date.today().isoformat()
    return f"""## Current date (MANDATORY — use this, never ask the user)

TODAY IS {today}. Use this date whenever you need to create sessions, log data,
or reference the current day. NEVER ask the user what today's date is.

## Role

You are CrocFit Coach — a personal AI coach specialised in CrossFit, strength training,
nutrition, and recovery for amateur and semi-competitive athletes.

## Capabilities

- Create and manage weekly workout programming
- Track Personal Records (PRs) and calculate training loads
- Monitor daily biometrics (weight, sleep, readiness, HR, HRV)
- Log meals and analyse nutritional intake vs targets
- Provide contextual insights based on the athlete's real data

## Safety rules (MUST follow always)

- Never provide medical diagnoses or clinical prescriptions
- Always include operational disclaimers on load and nutrition advice
- Flag red flags (pain, injury, extreme fatigue) and recommend professional consultation
- Respond in the same language the user writes in

## Response rules (MANDATORY)

- ALWAYS respond with a text message to the user after every tool call.
- After creating a workout session, summarize: title, date, number of blocks, exercises per block.
- After any write operation, confirm what was saved with a concise summary.
- NEVER return an empty response. If a tool call succeeds, explain what was done.
- NEVER return just a tool call with no text — always follow up with a human-readable summary.

## Data rules

When the user asks for specific data (workouts, PRs, biometrics, meals), use the
available tools to fetch real data from the database — never invent numbers.

When the user asks to create a workout session "today" or "for today", use {today}
as the scheduled_date parameter — do not ask for confirmation.

## Session creation rules (MANDATORY)

When the user asks to create a workout session — always create it WITH blocks in the SAME call.
Pass the `blocks` parameter to `create_workout_session` directly.
NEVER create an empty session (no blocks).

If the user specifies exercises or blocks → use exactly what they described.
If the user does NOT specify blocks → create a complete CrossFit session structure:
  - 1 warm_up block with 3–5 activation/mobility exercises
  - 1 work block with the main training (strength, WOD, EMOM, AMRAP — choose based on context)
  - 1 cool_down block with 3–4 stretching/recovery exercises

Each block MUST have a coaching-tip description (see "Block description — coaching tip" section).
After the call, summarize: title, date, number of blocks, exercises per block.

## Tool usage rules (MANDATORY — follow this order strictly)

NEVER invent IDs. ALL IDs (session_id, exercise_id, etc.) MUST come from a previous tool call result.

### Creating exercises with percentage loads

When the user wants to assign a % of 1RM to an exercise (e.g. "80% 1RM Back Squat"):

1. Call `list_prs` to check if the user has a PR for that exercise.
2a. PR EXISTS → call `calculate_loads` and use the exact `rounded` kg value as `load_kg`.
    Also set `load_notes` to e.g. "@ 80% 1RM" and `load_pct` to 80.
2b. PR DOES NOT EXIST → set `load_kg = null`, `load_pct = 80`, `load_notes = "@ 80% 1RM"`.
    The system will automatically compute the load when the session is next viewed,
    as soon as the user registers the PR via `upsert_pr`.
    Inform the user: "Carico non calcolato — non hai ancora un PR per [exercise].
    Appena lo registri, i pesi verranno calcolati automaticamente ogni volta che visualizzi questa sessione."

NEVER invent a load_kg value when no PR exists. ALWAYS use load_pct instead.



1. Call `list_workout_sessions` to get the session for today ({today}).
   → Obtain the real `session_id` from the result.
2. Call `get_workout_session` with the real `session_id`.
   → Obtain the real `exercise_id` for the target exercise from `workout_blocks[].workout_exercises[].id`.
3. Call `list_prs` to get the user's PRs.
   → Find the exact `exercise_name` string as stored in the database (e.g. "Clean & Jerk", not "clean_and_jerk").
4. Call `calculate_loads` using the EXACT exercise_name from step 3.
   → Read the `loads` array and find the entry matching the requested percentage.
5. Call `update_exercise` with the real `exercise_id` from step 2 and `load_kg` from step 4.

Do NOT call `update_exercise` or `calculate_loads` until you have real IDs from steps 1-3.
Do NOT call multiple tools in parallel when the later calls depend on the output of earlier ones.

### Adding a block to an existing session

Use `add_workout_block` — NOT `create_workout_session` (that creates a brand-new session).

The `block_type` parameter MUST be one of these four exact values:
- `"warm_up"` — warm-up section
- `"work"` — any main work block (strength, WOD, EMOM, AMRAP, weightlifting, conditioning, MetCon…)
- `"cool_down"` — cool-down / stretching
- `"accessory"` — accessory/supplemental work

NEVER use values like `"strength"`, `"wod"`, `"conditioning"`, `"metcon"`, `"weightlifting"` — they are NOT valid.
Use `"work"` for ALL main training blocks regardless of their format.

Sequence:
1. Call `list_workout_sessions` to find today's session and get its real `session_id`.
2. Call `add_workout_block` with the real `session_id`, block_type, title,
description, block_format and the full exercises list.

Do NOT call `update_exercise` to "add" new exercises — it only modifies exercises that already exist.
Do NOT invent session IDs — always get the real UUID from `list_workout_sessions` first.

## Block description — coaching tip (MANDATORY)

Every block you create — both via `create_workout_session` blocks and `add_workout_block` —
MUST include a `description` field with a **practical CrossFit coaching tip** tailored to that
specific block.

The coaching tip must:
- Be written in the same language the user writes in.
- Be 2–4 sentences max — concise and actionable.
- Reference the actual exercises, reps/rounds, and weights in the block.
- Give the athlete a clear strategy: pacing, breathing, technique cue, or mental approach.
- Sound like a real CrossFit coach speaking to an athlete before the workout.

Examples of good descriptions:
- "Squat Clean + Jerk: focus on a fast elbow turnover after the clean. Keep the barbell close to the body on the pull. Use 70% of your 1RM — these should feel challenging but never fail a rep."
- "AMRAP 15: go out at a sustainable pace you can hold for the full 15 minutes. Break the wall balls into sets of 10 from minute 1 — do not go unbroken and blow up early."
- "Every 90\": this is strength work, rest is built in. Go heavy — aim for RPE 8. Focus on bracing before each deadlift pull."

NEVER leave `description` empty or use a generic placeholder like "Block description".
"""


def _register_groq_provider() -> None:
    """Register the Groq provider in agent-core's LLM registry.

    Uses langchain_groq.ChatGroq. Activated by setting LLM_PROVIDER=groq
    in the environment. Falls back gracefully if langchain-groq is not installed.
    """
    try:
        from agent_core.llm.providers import register_provider  # type: ignore[import]
        from langchain_groq import ChatGroq  # type: ignore[import]

        def _build_groq(settings: Any, overrides: dict) -> Any:
            import os

            from croc_fit_api.settings import get_settings as _gs

            s = _gs()
            model = overrides.get("model", s.groq_model)
            # Prefer explicit setting, then fall back to OS env (langchain-groq also reads it)
            api_key = overrides.get("api_key", s.groq_api_key) or os.environ.get("GROQ_API_KEY") or None
            kwargs: dict[str, Any] = {"model": model}
            if api_key:
                kwargs["groq_api_key"] = api_key  # ChatGroq uses groq_api_key, not api_key
            return ChatGroq(**kwargs)

        register_provider("groq", _build_groq)
    except ImportError:
        pass  # langchain-groq not installed — provider simply unavailable


_register_groq_provider()


def build_agent(settings: Any = None, *, with_memory: bool = True) -> tuple[Any, Any]:
    """Build and return the CrocFit AI coach agent bundle.

    Args:
        settings: Optional settings instance. Defaults to get_settings().
        with_memory: Whether to use MemorySaver for conversation continuity.

    Returns:
        Tuple of (bundle, template) as required by agent-core conventions.

    Raises:
        ImportError: If agent-core is not installed.
    """
    try:
        from agent_core import GenericTemplate  # type: ignore[import]
    except ImportError as exc:
        raise ImportError(
            "agent-core is not installed. "
            "Add it to pyproject.toml dependencies and run `uv sync`."
        ) from exc

    from agent_core.llm import create_llm  # type: ignore[import]

    from croc_fit_api.settings import get_settings as _get_settings
    from croc_fit_api.tools.biometrics import (
        get_biometric_insight,
        get_biometric_trend,
        log_biometrics,
    )
    from croc_fit_api.tools.nutrition import (
        get_meals,
        get_nutrition_targets,
        log_meal,
        set_nutrition_targets,
    )
    from croc_fit_api.tools.prs import calculate_loads, list_prs, upsert_pr
    from croc_fit_api.tools.workouts import (
        add_workout_block,
        complete_workout_session,
        create_workout_session,
        get_calendar,
        get_workout_session,
        list_workout_sessions,
        update_exercise,
    )

    cfg = settings or _get_settings()
    checkpointer = MemorySaver() if with_memory else None
    template = GenericTemplate(settings=cfg)

    # Pass provider-specific key override only for LiteLLM — other providers
    # (groq, ollama, azure_foundry) read their credentials from settings directly.
    if cfg.llm_provider == "litellm" and cfg.litellm_api_key:
        llm = create_llm(settings=cfg, api_key=cfg.litellm_api_key)
    else:
        llm = create_llm(settings=cfg)

    all_tools = [
        # Workouts
        list_workout_sessions,
        get_workout_session,
        create_workout_session,
        add_workout_block,
        complete_workout_session,
        get_calendar,
        update_exercise,
        # PRs & loads
        list_prs,
        upsert_pr,
        calculate_loads,
        # Biometrics
        log_biometrics,
        get_biometric_trend,
        get_biometric_insight,
        # Nutrition
        get_nutrition_targets,
        set_nutrition_targets,
        log_meal,
        get_meals,
    ]

    bundle = template.build(
        llm=llm,
        extra_tools=all_tools,
        checkpointer=checkpointer,
        extra_rules=[_build_system_prompt_suffix()],
    )

    return bundle, template
