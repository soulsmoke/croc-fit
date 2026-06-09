"""Pydantic schemas for CrocFit API request/response contracts."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    """A single message in the chat history."""

    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    """POST /chat request body."""

    thread_id: str = Field(description="Conversation thread identifier (user-scoped)")
    message: str = Field(min_length=1, max_length=8000)
    user_id: str = Field(description="Supabase user UUID")
    history: list[ChatMessage] = Field(default_factory=list)


# ── Workout Sessions ──────────────────────────────────────────────────────────

class ExerciseCreate(BaseModel):
    """A single exercise within a workout block."""

    name: str = Field(min_length=1, max_length=200)
    sets: int | None = None
    reps: str = Field(default="")
    load_kg: float | None = None
    load_notes: str = Field(default="")


class WorkoutBlockCreate(BaseModel):
    """A block within a workout session (warm-up, strength, WOD, cool-down)."""

    block_type: Literal["warm_up", "work", "cool_down", "accessory"] = "work"
    title: str = Field(default="")
    description: str = Field(default="")
    format: str = Field(default="")
    notes: str = Field(default="")
    exercises: list[ExerciseCreate] = Field(default_factory=list)


class WorkoutSessionCreate(BaseModel):
    """POST /workouts request body."""

    title: str = Field(min_length=1, max_length=200)
    scheduled_date: date
    notes: str = Field(default="")
    blocks: list[WorkoutBlockCreate] = Field(default_factory=list)


class WorkoutSessionComplete(BaseModel):
    """POST /workouts/{id}/complete request body."""

    rpe: int | None = Field(default=None, ge=1, le=10)
    feedback: str = Field(default="")


class WorkoutSessionResponse(BaseModel):
    """Workout session response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    scheduled_date: date
    status: str
    rpe: int | None = None
    feedback: str = ""
    notes: str = ""
    created_at: datetime


# ── Personal Records ──────────────────────────────────────────────────────────

class PRCreate(BaseModel):
    """POST /prs request body."""

    exercise_name: str = Field(min_length=1, max_length=100)
    weight_kg: float = Field(gt=0)
    unit: Literal["kg", "lbs"] = "kg"


class LoadCalculateRequest(BaseModel):
    """POST /loads/calculate request body."""

    exercise_name: str
    round_to_kg: float = Field(default=2.5, gt=0)


# ── Biometrics ────────────────────────────────────────────────────────────────

class BiometricEntryCreate(BaseModel):
    """POST /biometrics request body."""

    date: date
    weight_kg: float | None = Field(default=None, gt=0)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    readiness: int | None = Field(default=None, ge=1, le=10)
    resting_hr: int | None = Field(default=None, ge=20, le=300)
    hrv: float | None = Field(default=None, ge=0)


# ── Nutrition ─────────────────────────────────────────────────────────────────

class NutritionTargetUpdate(BaseModel):
    """PUT /nutrition/targets request body."""

    kcal: int = Field(gt=0)
    protein_g: float = Field(gt=0)
    carbs_g: float = Field(gt=0)
    fat_g: float = Field(gt=0)


class MealLogCreate(BaseModel):
    """POST /meals request body."""

    date: date
    description: str = Field(min_length=1, max_length=2000)
    source: Literal["text", "image"] = "text"


# ── Attachments ───────────────────────────────────────────────────────────────

class AttachmentResponse(BaseModel):
    """Upload attachment response."""

    id: UUID
    url: str
    mime_type: str
    filename: str
    created_at: datetime
