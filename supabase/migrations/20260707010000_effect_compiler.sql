-- Effect Compiler: data-driven effect recipes + resumable run state.
create table if not exists public.effect_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  family text not null default 'custom',
  plan jsonb not null,
  version int not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.effect_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  project_id uuid references public.movie_projects(id) on delete set null,
  recipe_slug text,
  plan jsonb not null,
  -- { stageIdx, outputs: {stageId: {...}}, attempts: {stageId: n},
  --   pending: {stageId, predictionId} | null, critic: {stageId: verdict} }
  state jsonb not null default '{"stageIdx":0,"outputs":{},"attempts":{},"pending":null,"critic":{}}',
  status text not null default 'running', -- running | completed | failed
  final_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.effect_recipes enable row level security;
alter table public.effect_runs enable row level security;

-- Recipes are readable by all authenticated users (they're the effect catalog);
-- writes are service-role only (the compiler).
create policy effect_recipes_read on public.effect_recipes for select to authenticated using (true);
-- Runs: owners read their own.
create policy effect_runs_own on public.effect_runs for select to authenticated using (user_id = auth.uid());
