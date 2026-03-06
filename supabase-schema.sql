-- Supabase schema for No-Show online multiplayer and stats

-- Enable UUID extension (safe to run multiple times)
create extension if not exists "uuid-ossp";

-- =========================
-- Profiles (linked to auth)
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      'player_' || substr(new.id::text, 1, 8)
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =========================
-- Core game structures
-- =========================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'game_mode') then
    create type public.game_mode as enum ('vs_system', 'multiplayer_online', 'multiplayer_local');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'player_type') then
    create type public.player_type as enum ('human', 'bot');
  end if;
end$$;

create table if not exists public.games (
  id uuid primary key default uuid_generate_v4(),
  mode public.game_mode not null,
  max_players int not null check (max_players between 2 and 6),
  actual_players int,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  winner_player_id uuid,
  created_by uuid references public.profiles(id),
  is_ranked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid references public.profiles(id), -- null for bots or offline players
  display_name text not null,
  player_type public.player_type not null default 'human',
  seat_index int not null,
  is_bot boolean not null default false,
  final_score int,
  eliminated_at_round int,
  is_winner boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists game_players_game_id_idx on public.game_players (game_id);
create index if not exists game_players_user_id_idx on public.game_players (user_id);

create table if not exists public.game_events (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid references public.game_players(id),
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now()
);

create index if not exists game_events_game_id_occurred_at_idx
  on public.game_events (game_id, occurred_at);

-- =========================
-- Aggregate player stats
-- =========================

create table if not exists public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_games int not null default 0,
  total_wins int not null default 0,
  total_vs_system_games int not null default 0,
  total_vs_system_wins int not null default 0,
  total_multiplayer_games int not null default 0,
  total_multiplayer_wins int not null default 0,
  total_points_scored int not null default 0,
  total_points_against int not null default 0,
  last_played_at timestamptz
);

create index if not exists player_stats_last_played_at_idx
  on public.player_stats (last_played_at desc);

-- Simple upsert helper for stats (backend can call via service key)
create or replace function public.upsert_player_stats(
  p_user_id uuid,
  p_mode public.game_mode,
  p_points_scored int,
  p_points_against int,
  p_did_win boolean
)
returns void as $$
begin
  insert into public.player_stats (
    user_id,
    total_games,
    total_wins,
    total_vs_system_games,
    total_vs_system_wins,
    total_multiplayer_games,
    total_multiplayer_wins,
    total_points_scored,
    total_points_against,
    last_played_at
  )
  values (
    p_user_id,
    1,
    case when p_did_win then 1 else 0 end,
    case when p_mode = 'vs_system' then 1 else 0 end,
    case when p_mode = 'vs_system' and p_did_win then 1 else 0 end,
    case when p_mode = 'multiplayer_online' or p_mode = 'multiplayer_local' then 1 else 0 end,
    case when (p_mode = 'multiplayer_online' or p_mode = 'multiplayer_local') and p_did_win then 1 else 0 end,
    coalesce(p_points_scored, 0),
    coalesce(p_points_against, 0),
    now()
  )
  on conflict (user_id) do update
  set
    total_games = player_stats.total_games + 1,
    total_wins = player_stats.total_wins + case when p_did_win then 1 else 0 end,
    total_vs_system_games = player_stats.total_vs_system_games +
      case when p_mode = 'vs_system' then 1 else 0 end,
    total_vs_system_wins = player_stats.total_vs_system_wins +
      case when p_mode = 'vs_system' and p_did_win then 1 else 0 end,
    total_multiplayer_games = player_stats.total_multiplayer_games +
      case when p_mode = 'multiplayer_online' or p_mode = 'multiplayer_local' then 1 else 0 end,
    total_multiplayer_wins = player_stats.total_multiplayer_wins +
      case when (p_mode = 'multiplayer_online' or p_mode = 'multiplayer_local') and p_did_win then 1 else 0 end,
    total_points_scored = player_stats.total_points_scored + coalesce(p_points_scored, 0),
    total_points_against = player_stats.total_points_against + coalesce(p_points_against, 0),
    last_played_at = now();
end;
$$ language plpgsql security definer;

-- =========================
-- Row Level Security (RLS)
-- =========================

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_events enable row level security;
alter table public.player_stats enable row level security;

-- Profiles: users can see and update only their own profile
create policy if not exists "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy if not exists "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Games: users can see games where they participated
create policy if not exists "games_select_participant"
  on public.games
  for select
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.game_id = games.id
        and gp.user_id = auth.uid()
    )
  );

-- Game players: users can see rows where they are the human user
create policy if not exists "game_players_select_own_games"
  on public.game_players
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.game_players gp
      where gp.game_id = game_players.game_id
        and gp.user_id = auth.uid()
    )
  );

-- Game events: read-only for participants (optional, can be restricted further)
create policy if not exists "game_events_select_participant"
  on public.game_events
  for select
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.game_id = game_events.game_id
        and gp.user_id = auth.uid()
    )
  );

-- Player stats: users can see their own stats
create policy if not exists "player_stats_select_own"
  on public.player_stats
  for select
  using (user_id = auth.uid());

-- Note: inserts/updates for games, game_players, game_events, player_stats
-- will typically be performed by the backend using the service role key,
-- which bypasses RLS. If you later want to allow client writes, you can add
-- additional insert/update policies as needed.

