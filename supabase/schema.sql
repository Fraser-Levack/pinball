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

-- Likes, added after builds shipped. If the rest is already set up, run just this part.
-- No accounts: each browser has an anonymous id, and gets one like per app.
alter table public.builds add column if not exists like_count integer not null default 0 check (like_count >= 0);

create table if not exists public.build_likes (
  build_id uuid not null references public.builds (id) on delete cascade,
  liker uuid not null,
  created_at timestamptz not null default now(),
  primary key (build_id, liker)
);

create index if not exists build_likes_liker_idx on public.build_likes (liker);
create index if not exists builds_popular_idx on public.builds (featured, like_count desc, created_at desc);

-- No policies: who liked what is only read and written by the server.
alter table public.build_likes enable row level security;

-- Keeps builds.like_count in step with build_likes, so sorting by popularity is cheap.
create or replace function public.count_build_like() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.builds set like_count = like_count + 1 where id = new.build_id;
  else
    update public.builds set like_count = like_count - 1 where id = old.build_id;
  end if;
  return null;
end $$;

drop trigger if exists build_likes_count on public.build_likes;
create trigger build_likes_count after insert or delete on public.build_likes
  for each row execute function public.count_build_like();
