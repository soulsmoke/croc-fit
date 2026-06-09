-- CrocFit Coach AI — Demo Seed
-- Seed for local development only. DO NOT run in production.
-- Uses a fixed demo user UUID — create this user in Supabase Auth first.

-- Demo user UUID (create via: supabase auth admin create-user demo@crocfit.local)
-- Replace this with the actual UUID from your local Supabase instance.
do $$
declare
    demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
begin
    -- Athlete profile
    insert into public.athlete_profiles (user_id, display_name, birth_year, height_cm, goal)
    values (demo_user_id, 'Demo Athlete', 1992, 175.0, 'Build strength and improve endurance for CrossFit competition.')
    on conflict (user_id) do nothing;

    -- Sample workout sessions
    insert into public.workout_sessions (user_id, title, scheduled_date, status, rpe, feedback)
    values
        (demo_user_id, 'Monday Strength — Back Squat', current_date - 6, 'completed', 8, 'Felt strong on the squats. Hit all sets at prescribed load.'),
        (demo_user_id, 'Tuesday Metcon — Fran', current_date - 5, 'completed', 9, '6:32 on Fran. Best time this year.'),
        (demo_user_id, 'Thursday Olympic Lifting', current_date - 3, 'completed', 7, 'Worked on clean technique at 75%.'),
        (demo_user_id, 'Saturday WOD', current_date - 1, 'planned', null, ''),
        (demo_user_id, 'Monday Strength — Deadlift', current_date + 2, 'planned', null, '')
    on conflict do nothing;

    -- Personal records
    insert into public.personal_records (user_id, exercise_name, weight_kg, unit)
    values
        (demo_user_id, 'Back Squat', 120.0, 'kg'),
        (demo_user_id, 'Deadlift', 145.0, 'kg'),
        (demo_user_id, 'Clean and Jerk', 90.0, 'kg'),
        (demo_user_id, 'Snatch', 72.5, 'kg'),
        (demo_user_id, 'Bench Press', 100.0, 'kg'),
        (demo_user_id, 'Overhead Press', 70.0, 'kg'),
        (demo_user_id, 'Front Squat', 100.0, 'kg')
    on conflict (user_id, exercise_name) do nothing;

    -- Biometric entries (last 7 days)
    insert into public.biometric_entries (user_id, date, weight_kg, sleep_hours, readiness, resting_hr, hrv)
    values
        (demo_user_id, current_date - 6, 83.2, 7.5, 8, 52, 68.0),
        (demo_user_id, current_date - 5, 83.0, 6.5, 6, 56, 55.0),
        (demo_user_id, current_date - 4, 83.4, 8.0, 9, 50, 72.0),
        (demo_user_id, current_date - 3, 83.1, 7.0, 7, 54, 62.0),
        (demo_user_id, current_date - 2, 83.3, 7.5, 8, 51, 70.0),
        (demo_user_id, current_date - 1, 83.0, 8.5, 9, 49, 75.0),
        (demo_user_id, current_date,     83.2, 7.0, 8, 52, 67.0)
    on conflict (user_id, date) do nothing;

    -- Nutrition targets
    insert into public.nutrition_targets (user_id, kcal, protein_g, carbs_g, fat_g, active)
    values (demo_user_id, 2800, 200.0, 300.0, 80.0, true)
    on conflict do nothing;

    -- Sample meal logs (today)
    insert into public.meal_logs (user_id, date, description, source)
    values
        (demo_user_id, current_date, 'Oatmeal with banana and whey protein shake (approx 550 kcal, 45g protein)', 'text'),
        (demo_user_id, current_date, 'Chicken breast with rice and vegetables (approx 700 kcal, 55g protein)', 'text')
    on conflict do nothing;

end $$;
