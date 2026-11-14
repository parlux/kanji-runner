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
