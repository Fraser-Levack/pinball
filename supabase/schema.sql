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

-- Apps that players built from their prompts and chose to share. Each one belongs to the
-- leaderboard run that produced its prompt (player name, score and prompt come from there).
-- To feature an app, flip its flag in the Table Editor or run:
--   update public.builds set featured = true where id = '...';
create table if not exists public.builds (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores (id) on delete cascade,
  build_key text not null unique check (char_length(build_key) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 600),
  html text not null check (octet_length(html) <= 1000000),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- Added after builds first shipped: the page's own <title>, shown as the app's name.
alter table public.builds add column if not exists title text check (char_length(title) between 1 and 60);

create index if not exists builds_featured_idx on public.builds (featured, created_at desc);
create index if not exists builds_score_idx on public.builds (score_id);

-- Same rules as scores: readable by everyone, written only by the server.
alter table public.builds enable row level security;

create policy "builds are readable by everyone"
  on public.builds for select
  using (true);
