-- Room-based multiplayer: run this in Supabase SQL Editor after supabase-schema.sql
-- Adds: rooms, room_players. Room games are persisted with mode 'multiplayer_online'.

-- =========================
-- Rooms (friend lobby)
-- =========================

create table if not exists public.rooms (
  id uuid primary key default uuid_generate_v4(),
  room_code text unique not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'in_game', 'finished')),
  game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_room_code_idx on public.rooms (room_code);
create index if not exists rooms_owner_id_idx on public.rooms (owner_id);

-- =========================
-- Room players (lobby members)
-- =========================

create table if not exists public.room_players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  is_owner boolean not null default false,
  is_ready boolean not null default false,
  seat_index int,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

create index if not exists room_players_room_id_idx on public.room_players (room_id);
create index if not exists room_players_user_id_idx on public.room_players (user_id);

-- =========================
-- RLS for rooms and room_players
-- =========================

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

drop policy if exists "rooms_select_member" on public.rooms;
create policy "rooms_select_member"
  on public.rooms for select
  using (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = rooms.id and rp.user_id = auth.uid()
    )
  );

drop policy if exists "room_players_select_member" on public.room_players;
create policy "room_players_select_member"
  on public.room_players for select
  using (
    exists (
      select 1 from public.room_players rp2
      where rp2.room_id = room_players.room_id and rp2.user_id = auth.uid()
    )
  );

-- Inserts/updates for rooms and room_players are done by the backend with service role.
-- If you want client-side create/join, add insert/update policies here.
