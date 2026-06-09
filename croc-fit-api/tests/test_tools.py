"""Tests for load calculation tool and safety guard."""

import pytest

from croc_fit_api.tools.prs import LOAD_PERCENTAGES, calculate_loads
from croc_fit_api.tools.safety import check_safety


@pytest.mark.asyncio
async def test_calculate_loads_raises_when_no_pr(monkeypatch: pytest.MonkeyPatch) -> None:
    """calculate_loads raises ValueError when no PR exists for the exercise."""

    async def _mock_get_pr(user_id: str, exercise_name: str) -> None:
        return None

    monkeypatch.setattr("croc_fit_api.tools.prs.get_pr", _mock_get_pr)

    with pytest.raises(ValueError, match="No PR found"):
        await calculate_loads("user-1", "Back Squat")


@pytest.mark.asyncio
async def test_calculate_loads_returns_correct_table(monkeypatch: pytest.MonkeyPatch) -> None:
    """calculate_loads returns a load table with correct percentages and rounded weights."""

    async def _mock_get_pr(user_id: str, exercise_name: str) -> dict:
        return {"weight_kg": 100.0}

    monkeypatch.setattr("croc_fit_api.tools.prs.get_pr", _mock_get_pr)

    result = await calculate_loads("user-1", "Back Squat", round_to_kg=2.5)

    assert result["exercise"] == "Back Squat"
    assert result["pr_kg"] == 100.0
    assert len(result["loads"]) == len(LOAD_PERCENTAGES)
    assert "disclaimer" in result

    # 100% of 100 kg = 100 kg
    hundred_pct = next(entry for entry in result["loads"] if entry["percentage"] == 100)
    assert hundred_pct["weight_kg"] == 100.0

    # 75% of 100 kg = 75 kg → rounded to 75.0 (multiple of 2.5)
    seventy_five = next(entry for entry in result["loads"] if entry["percentage"] == 75)
    assert seventy_five["weight_kg"] % 2.5 == 0


@pytest.mark.asyncio
async def test_calculate_loads_rounds_correctly(monkeypatch: pytest.MonkeyPatch) -> None:
    """Loads are rounded to the nearest multiple of round_to_kg."""

    async def _mock_get_pr(user_id: str, exercise_name: str) -> dict:
        return {"weight_kg": 83.0}

    monkeypatch.setattr("croc_fit_api.tools.prs.get_pr", _mock_get_pr)

    result = await calculate_loads("user-1", "Clean and Jerk", round_to_kg=2.5)

    for load in result["loads"]:
        assert load["weight_kg"] % 2.5 == 0.0, f"{load['weight_kg']} is not a multiple of 2.5"


# ── Safety guard tests ────────────────────────────────────────────────────────


def test_check_safety_no_flag_on_normal_message() -> None:
    """check_safety returns no flag for a regular fitness message."""
    result = check_safety("Qual è il mio PR per lo squat?")
    assert result.has_red_flag is False
    assert result.matched_terms == ()
    assert result.disclaimer == ""


def test_check_safety_detects_injury_keyword() -> None:
    """check_safety detects 'infortun' substring in message."""
    result = check_safety("Ho un infortunio al ginocchio, posso allenarmi?")
    assert result.has_red_flag is True
    assert any("infortun" in t for t in result.matched_terms)
    assert "⚠️" in result.disclaimer


def test_check_safety_detects_medical_keyword() -> None:
    """check_safety detects 'diagnosi' in message."""
    result = check_safety("Ho ricevuto una diagnosi di tendinite")
    assert result.has_red_flag is True
    assert "diagnosi" in result.matched_terms


def test_check_safety_is_case_insensitive() -> None:
    """check_safety matches keywords regardless of case."""
    result = check_safety("Ho DOLORE ACUTO alla schiena")
    assert result.has_red_flag is True


def test_check_safety_detects_english_keyword() -> None:
    """check_safety detects English red-flag terms."""
    result = check_safety("I have sharp pain in my shoulder")
    assert result.has_red_flag is True
