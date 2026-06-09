-- CrocFit Coach AI — Exercise completion tracking
-- Migration: 002_exercise_completion
-- Idempotent: safe to re-run

-- Add completion tracking and per-exercise notes to workout_exercises
alter table public.workout_exercises
    add column if not exists completed    boolean not null default false,
    add column if not exists ex_notes     text not null default '',
    add column if not exists completed_at timestamptz;

-- Add description and format metadata to workout_blocks
alter table public.workout_blocks
    add column if not exists description  text not null default '',
    add column if not exists format       text not null default '';
