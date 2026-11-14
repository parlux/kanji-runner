-- Progress sync table and row-level security (as live in the Supabase project).
create table public.progress (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "own select" on public.progress
  for select using (user_id = auth.uid());

create policy "own insert" on public.progress
  for insert with check (user_id = auth.uid());

create policy "own update" on public.progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Horde gauntlet results (dev tool, `?sandbox=horde`): one row per finished
-- gauntlet run. NOT live yet: the owner runs this block once in the Supabase
-- dashboard (SQL Editor). The laptop reads the rows with
-- `npx tsx scripts/gauntlet-results.ts`, using the service-role key.
create table public.tuning_results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  data jsonb not null
);

alter table public.tuning_results enable row level security;

create policy "own select" on public.tuning_results
  for select using (user_id = auth.uid());

create policy "own insert" on public.tuning_results
  for insert with check (user_id = auth.uid());
