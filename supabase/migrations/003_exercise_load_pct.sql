-- Migration 003: Add load_pct to workout_exercises
-- Stores the percentage of 1RM so loads can be recalculated automatically
-- when the user logs a new PR after the session was created.
-- 2026-06-09

alter table public.workout_exercises
    add column if not exists load_pct numeric(5,2) default null;

comment on column public.workout_exercises.load_pct is
    'Percentage of 1RM (e.g. 80.0 for 80%). '
    'When set and load_kg is NULL, load_kg is auto-filled upon PR upsert.';

create index if not exists idx_workout_exercises_load_pct
    on public.workout_exercises(load_pct)
    where load_pct is not null and load_kg is null;
