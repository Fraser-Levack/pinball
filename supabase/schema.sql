-- Run this once in the Supabase dashboard: SQL Editor -> New query -> Run.

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(player_name) between 1 and 16),
  score integer not null check (score >= 0),
  sections integer not null check (sections >= 0),
  prompt text not null check (char_length(prompt) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists scores_score_idx on public.scores (score desc);

-- Anyone can read the leaderboard. There is no insert/update/delete policy, so
-- anonymous clients cannot write; the app writes through its server route, which
-- uses the service role key (that key bypasses RLS).
alter table public.scores enable row level security;

create policy "scores are readable by everyone"
  on public.scores for select
  using (true);
