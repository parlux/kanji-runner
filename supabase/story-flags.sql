-- Story flags: "this story is bad" from the study and pause cards.
-- The owner runs this once in the Supabase dashboard (SQL Editor).
-- The laptop lists the rows with `npm run stories:flags` (service-role key).
create table public.story_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kanji text not null,
  level text not null,
  note text not null default '',
  build text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.story_flags enable row level security;

create policy "own select" on public.story_flags
  for select using (user_id = auth.uid());

create policy "own insert" on public.story_flags
  for insert with check (user_id = auth.uid());
