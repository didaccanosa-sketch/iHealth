-- iHealth — esquema inicial de base de datos
-- Cómo usarlo: Supabase → tu proyecto → SQL Editor → pegar todo esto → Run

-- ─── PERFILES ────────────────────────────────────────────────────────────────
-- Se crea automáticamente un perfil cuando alguien se registra (ver trigger al final).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  height_cm numeric,
  starting_weight_kg numeric,
  level text default 'principiante' check (level in ('principiante','avanzado')),
  lang text default 'es' check (lang in ('es','en')),
  theme text default 'dark' check (theme in ('dark','light')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;
drop policy if exists "profiles: select own" on profiles;
create policy "profiles: select own" on profiles for select using (auth.uid() = id);
drop policy if exists "profiles: update own" on profiles;
create policy "profiles: update own" on profiles for update using (auth.uid() = id);
drop policy if exists "profiles: insert own" on profiles;
create policy "profiles: insert own" on profiles for insert with check (auth.uid() = id);

-- ─── OBJETIVO (Goal Engine) ──────────────────────────────────────────────────
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  current_weight_kg numeric,
  target_weight_kg numeric,
  target_date date,
  goal_type text check (goal_type in ('perder_grasa','ganar_musculo','mantener','rendimiento')),
  active boolean default true,
  created_at timestamptz default now()
);

alter table goals enable row level security;
drop policy if exists "goals: all own" on goals;
create policy "goals: all own" on goals for all using (auth.uid() = user_id);

-- ─── PESO ────────────────────────────────────────────────────────────────────
create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  kg numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz default now()
);

alter table weight_logs enable row level security;
drop policy if exists "weight_logs: all own" on weight_logs;
create policy "weight_logs: all own" on weight_logs for all using (auth.uid() = user_id);

-- ─── COMIDAS (Nutrition Engine) ──────────────────────────────────────────────
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  description text not null,
  kcal numeric default 0,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  fiber_g numeric default 0,
  source text default 'chat' check (source in ('chat','photo','template')),
  meal_slot int default 1, -- Meal 1, Meal 2, Meal 3...
  logged_at date not null default current_date,
  logged_time time not null default current_time,
  created_at timestamptz default now()
);

alter table meals enable row level security;
drop policy if exists "meals: all own" on meals;
create policy "meals: all own" on meals for all using (auth.uid() = user_id);

-- ─── AGUA ────────────────────────────────────────────────────────────────────
create table if not exists water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  ml numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz default now()
);

alter table water_logs enable row level security;
drop policy if exists "water_logs: all own" on water_logs;
create policy "water_logs: all own" on water_logs for all using (auth.uid() = user_id);

-- ─── CHECKLIST DIARIO (Today) ────────────────────────────────────────────────
create table if not exists daily_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  label text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table daily_checklist_items enable row level security;
drop policy if exists "checklist items: all own" on daily_checklist_items;
create policy "checklist items: all own" on daily_checklist_items for all using (auth.uid() = user_id);

create table if not exists daily_checklist_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  item_id uuid references daily_checklist_items(id) on delete cascade not null,
  done boolean default false,
  logged_at date not null default current_date,
  created_at timestamptz default now(),
  unique (item_id, logged_at)
);

alter table daily_checklist_logs enable row level security;
drop policy if exists "checklist logs: all own" on daily_checklist_logs;
create policy "checklist logs: all own" on daily_checklist_logs for all using (auth.uid() = user_id);

-- ─── TRIGGER: crear perfil automáticamente al registrarse ───────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Nota: las tablas del Workout Engine (mesociclos, sesiones, ejercicios, PRs)
-- se añadirán en un siguiente paso, cuando portemos esa parte desde la versión
-- web actual.

-- ─── PLANTILLAS DE COMIDA (guardar una comida para reusarla) ────────────────
create table if not exists meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  description text not null,
  kcal numeric default 0,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  fiber_g numeric default 0,
  created_at timestamptz default now()
);

alter table meal_templates enable row level security;
drop policy if exists "meal_templates: all own" on meal_templates;
create policy "meal_templates: all own" on meal_templates for all using (auth.uid() = user_id);

-- ─── OBJETIVO: histórico de recálculos de ETA (Goal Engine) ─────────────────
create table if not exists goal_predictions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  eta_date date,
  is_realistic boolean,
  note text,
  created_at timestamptz default now()
);

alter table goal_predictions enable row level security;
drop policy if exists "goal_predictions: all own" on goal_predictions;
create policy "goal_predictions: all own" on goal_predictions for all using (auth.uid() = user_id);

-- ─── WORKOUT ENGINE: mesociclos ──────────────────────────────────────────────
create table if not exists mesocycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  height_cm numeric,
  level text check (level in ('principiante','avanzado')) default 'principiante',
  phase text check (phase in ('volumen','mantenimiento','definicion')) default 'volumen',
  duration_weeks int not null default 6,
  days_per_week int not null default 4,
  current_index int not null default 0,
  started boolean not null default false,
  finished boolean not null default false,
  created_at timestamptz default now()
);
alter table mesocycles add column if not exists started boolean not null default false;

alter table mesocycles enable row level security;
drop policy if exists "mesocycles: all own" on mesocycles;
create policy "mesocycles: all own" on mesocycles for all using (auth.uid() = user_id);

-- Un "día" de la rutina del meso (ej. "Empuje"), se repite cada semana
create table if not exists meso_days (
  id uuid primary key default gen_random_uuid(),
  mesocycle_id uuid references mesocycles(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  day_index int not null,
  label text not null,
  created_at timestamptz default now()
);

alter table meso_days enable row level security;
drop policy if exists "meso_days: all own" on meso_days;
create policy "meso_days: all own" on meso_days for all using (auth.uid() = user_id);

-- Ejercicios dentro de cada día del meso
create table if not exists meso_exercises (
  id uuid primary key default gen_random_uuid(),
  meso_day_id uuid references meso_days(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  muscle_group text not null,
  sets int not null default 3,
  reps text not null default '8-12',
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table meso_exercises enable row level security;
drop policy if exists "meso_exercises: all own" on meso_exercises;
create policy "meso_exercises: all own" on meso_exercises for all using (auth.uid() = user_id);

-- Sesiones del meso (una por cada vez que toca entrenar, incluida la descarga)
create table if not exists meso_sessions (
  id uuid primary key default gen_random_uuid(),
  mesocycle_id uuid references mesocycles(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  session_index int not null,
  completed boolean not null default false,
  completed_at date,
  difficulty text check (difficulty in ('facil','normal','dificil','limite')),
  joint_pain boolean default false,
  joint text,
  sore_exercise text,
  note text,
  created_at timestamptz default now(),
  unique (mesocycle_id, session_index)
);

alter table meso_sessions enable row level security;
drop policy if exists "meso_sessions: all own" on meso_sessions;
create policy "meso_sessions: all own" on meso_sessions for all using (auth.uid() = user_id);

-- Series registradas dentro de una sesión
create table if not exists meso_session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references meso_sessions(id) on delete cascade not null,
  exercise_id uuid references meso_exercises(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  set_index int not null,
  kg numeric,
  reps int,
  is_pr boolean default false,
  created_at timestamptz default now(),
  unique (session_id, exercise_id, set_index)
);

alter table meso_session_sets enable row level security;
drop policy if exists "meso_session_sets: all own" on meso_session_sets;
create policy "meso_session_sets: all own" on meso_session_sets for all using (auth.uid() = user_id);

-- Marcas personales (PRs), una fila por ejercicio con la mejor marca conocida
create table if not exists personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  exercise_name text not null,
  est_1rm numeric not null,
  kg numeric not null,
  reps int not null,
  achieved_at date not null default current_date,
  created_at timestamptz default now(),
  unique (user_id, exercise_name)
);

alter table personal_records enable row level security;
drop policy if exists "personal_records: all own" on personal_records;
create policy "personal_records: all own" on personal_records for all using (auth.uid() = user_id);

-- ─── INSIGHTS DE IA (caché — nunca se reprocesa el mismo contenido) ─────────
create table if not exists ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  kind text not null, -- 'today_summary' | 'routine_review' | ...
  input_hash text not null,
  content jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, kind, input_hash)
);

alter table ai_insights enable row level security;
drop policy if exists "ai_insights: all own" on ai_insights;
create policy "ai_insights: all own" on ai_insights for all using (auth.uid() = user_id);

-- Cuando el usuario cambia el número de series "solo para esta sesión" (sin
-- tocar la plantilla del ejercicio, que afectaría a todas las semanas)
create table if not exists meso_session_overrides (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references meso_sessions(id) on delete cascade not null,
  exercise_id uuid references meso_exercises(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  sets int not null,
  created_at timestamptz default now(),
  unique (session_id, exercise_id)
);

alter table meso_session_overrides enable row level security;
drop policy if exists "meso_session_overrides: all own" on meso_session_overrides;
create policy "meso_session_overrides: all own" on meso_session_overrides for all using (auth.uid() = user_id);
grant select, insert, update, delete on meso_session_overrides to authenticated, anon;
