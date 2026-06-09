-- CrocFit Coach AI — Initial Schema
-- Migration: 001_initial_schema
-- Idempotent: safe to re-run

-- ── Extensions ──────────────────────────────────────────────────────────────


-- ── athlete_profiles ────────────────────────────────────────────────────────
create table if not exists public.athlete_profiles (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users(id) on delete cascade,
    display_name   text not null default '',
    birth_year     int,
    height_cm      numeric(5,1),
    goal           text default '',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique(user_id)
);

-- ── workout_sessions ────────────────────────────────────────────────────────
create table if not exists public.workout_sessions (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    title           text not null,
    scheduled_date  date not null,
    status          text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
    rpe             int check (rpe between 1 and 10),
    feedback        text default '',
    notes           text default '',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_workout_sessions_user_date
    on public.workout_sessions(user_id, scheduled_date desc);

-- ── workout_blocks ──────────────────────────────────────────────────────────
create table if not exists public.workout_blocks (
    id          uuid primary key default gen_random_uuid(),
    session_id  uuid not null references public.workout_sessions(id) on delete cascade,
    block_type  text not null default 'work' check (block_type in ('warm_up', 'work', 'cool_down', 'accessory')),
    title       text not null default '',
    notes       text default '',
    position    int not null default 0,
    created_at  timestamptz not null default now()
);

create index if not exists idx_workout_blocks_session
    on public.workout_blocks(session_id, position);

-- ── workout_exercises ────────────────────────────────────────────────────────
create table if not exists public.workout_exercises (
    id           uuid primary key default gen_random_uuid(),
    block_id     uuid not null references public.workout_blocks(id) on delete cascade,
    name         text not null,
    sets         int,
    reps         text,        -- can be "5" or "5-3-1" or "AMRAP"
    load_kg      numeric(6,2),
    load_notes   text default '',
    position     int not null default 0,
    created_at   timestamptz not null default now()
);

create index if not exists idx_workout_exercises_block
    on public.workout_exercises(block_id, position);

-- ── personal_records ────────────────────────────────────────────────────────
create table if not exists public.personal_records (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users(id) on delete cascade,
    exercise_name  text not null,
    weight_kg      numeric(6,2) not null,
    unit           text not null default 'kg' check (unit in ('kg', 'lbs')),
    recorded_at    timestamptz not null default now(),
    notes          text default '',
    unique(user_id, exercise_name)
);

create index if not exists idx_personal_records_user
    on public.personal_records(user_id, exercise_name);

-- ── biometric_entries ────────────────────────────────────────────────────────
create table if not exists public.biometric_entries (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    date         date not null,
    weight_kg    numeric(5,2),
    sleep_hours  numeric(4,2),
    readiness    int check (readiness between 1 and 10),
    resting_hr   int,
    hrv          numeric(7,2),
    notes        text default '',
    created_at   timestamptz not null default now(),
    unique(user_id, date)
);

create index if not exists idx_biometric_entries_user_date
    on public.biometric_entries(user_id, date desc);

-- ── nutrition_targets ────────────────────────────────────────────────────────
create table if not exists public.nutrition_targets (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    kcal        int not null check (kcal > 0),
    protein_g   numeric(6,1) not null,
    carbs_g     numeric(6,1) not null,
    fat_g       numeric(6,1) not null,
    active      boolean not null default true,
    created_at  timestamptz not null default now()
);

create index if not exists idx_nutrition_targets_user_active
    on public.nutrition_targets(user_id, active);

-- ── meal_logs ────────────────────────────────────────────────────────────────
create table if not exists public.meal_logs (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    date         date not null,
    description  text not null,
    source       text not null default 'text' check (source in ('text', 'image')),
    created_at   timestamptz not null default now()
);

create index if not exists idx_meal_logs_user_date
    on public.meal_logs(user_id, date desc);

-- ── coach_threads ────────────────────────────────────────────────────────────
create table if not exists public.coach_threads (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    title       text default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique(user_id, id)
);

-- ── coach_messages ───────────────────────────────────────────────────────────
create table if not exists public.coach_messages (
    id          uuid primary key default gen_random_uuid(),
    thread_id   uuid not null references public.coach_threads(id) on delete cascade,
    role        text not null check (role in ('user', 'assistant', 'system')),
    content     text not null,
    created_at  timestamptz not null default now()
);

create index if not exists idx_coach_messages_thread
    on public.coach_messages(thread_id, created_at);

-- ── attachments ──────────────────────────────────────────────────────────────
create table if not exists public.attachments (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    message_id    uuid references public.coach_messages(id) on delete set null,
    filename      text not null,
    mime_type     text not null,
    storage_path  text not null,
    url           text not null,
    created_at    timestamptz not null default now()
);

create index if not exists idx_attachments_user
    on public.attachments(user_id, created_at desc);

-- ── updated_at triggers ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

do $$ begin
    if not exists (
        select 1 from pg_trigger where tgname = 'trg_athlete_profiles_updated_at'
    ) then
        create trigger trg_athlete_profiles_updated_at
            before update on public.athlete_profiles
            for each row execute function public.set_updated_at();
    end if;
end $$;

do $$ begin
    if not exists (
        select 1 from pg_trigger where tgname = 'trg_workout_sessions_updated_at'
    ) then
        create trigger trg_workout_sessions_updated_at
            before update on public.workout_sessions
            for each row execute function public.set_updated_at();
    end if;
end $$;

do $$ begin
    if not exists (
        select 1 from pg_trigger where tgname = 'trg_coach_threads_updated_at'
    ) then
        create trigger trg_coach_threads_updated_at
            before update on public.coach_threads
            for each row execute function public.set_updated_at();
    end if;
end $$;

-- ── RLS (structure ready, policies to be enabled in phase 2) ─────────────────
alter table public.athlete_profiles enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.personal_records enable row level security;
alter table public.biometric_entries enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.meal_logs enable row level security;
alter table public.coach_threads enable row level security;
alter table public.coach_messages enable row level security;
alter table public.attachments enable row level security;

-- Minimal read policy for authenticated users (own data only)
drop policy if exists "Users can read own athlete profile" on public.athlete_profiles;
create policy "Users can read own athlete profile"
    on public.athlete_profiles for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can read own workout sessions" on public.workout_sessions;
create policy "Users can read own workout sessions"
    on public.workout_sessions for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can read own PRs" on public.personal_records;
create policy "Users can read own PRs"
    on public.personal_records for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can read own biometrics" on public.biometric_entries;
create policy "Users can read own biometrics"
    on public.biometric_entries for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can read own nutrition targets" on public.nutrition_targets;
create policy "Users can read own nutrition targets"
    on public.nutrition_targets for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can read own meal logs" on public.meal_logs;
create policy "Users can read own meal logs"
    on public.meal_logs for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can read own coach threads" on public.coach_threads;
create policy "Users can read own coach threads"
    on public.coach_threads for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can read own coach messages" on public.coach_messages;
create policy "Users can read own coach messages"
    on public.coach_messages for select
    to authenticated
    using (
        thread_id in (
            select id from public.coach_threads where user_id = auth.uid()
        )
    );
