-- Database schema for Called It.
--
-- Run this once against a fresh Supabase project. The server writes to these
-- tables using the service role key. Phones only read, and they read live
-- updates through Supabase Realtime, so make sure Realtime is turned on for the
-- tables listed at the bottom of this file.

-- Matches we can build a room around.
create table if not exists fixtures (
  id           text primary key,
  competition  text not null,
  home_team    text not null,
  away_team    text not null,
  kickoff_at   timestamptz not null
);

-- A private game room created by one player.
create table if not exists rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  creator_id   text not null,
  fixture_id   text not null references fixtures(id),
  team_a       text not null check (team_a in ('home', 'away')),
  wager_type   text not null check (wager_type in ('money', 'forfeit')),
  stake_usd    integer not null default 0 check (stake_usd between 0 and 100),
  payout_mode  text not null check (payout_mode in ('winner_takes_all', 'top_three', 'all_but_loser')),
  forfeit_text text,
  status       text not null default 'open'
                 check (status in ('open', 'locked', 'live', 'settled', 'cancelled')),
  pool_address text,
  created_at   timestamptz not null default now(),
  lock_at      timestamptz not null
);

-- A player in a room.
create table if not exists members (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  user_id        text not null,
  display_name   text not null,
  mascot_id      text not null,
  wallet_address text,
  is_creator     boolean not null default false,
  deposit_state  text not null default 'none'
                   check (deposit_state in ('none', 'pending', 'deposited', 'refunded', 'paid')),
  joined_at      timestamptz not null default now(),
  unique (room_id, user_id)
);

-- The five questions for a room. Slot five is always the three point question.
create table if not exists questions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  slot        integer not null check (slot between 1 and 5),
  template_id text not null,
  team        text check (team in ('home', 'away')),
  text        text not null,
  points      integer not null,
  outcome     text not null default 'pending'
                check (outcome in ('pending', 'yes', 'no', 'void')),
  resolved_at timestamptz,
  unique (room_id, slot)
);

-- One player's swipe on one question.
create table if not exists answers (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  choice      text not null check (choice in ('yes', 'no')),
  locked_at   timestamptz not null default now(),
  unique (member_id, question_id)
);

-- The stream of things that happened in a match, used for the live ticker.
create table if not exists match_events (
  id          bigserial primary key,
  fixture_id  text not null references fixtures(id),
  kind        text not null,
  team        text check (team in ('home', 'away')),
  minute      integer,
  phase       text,
  seq         bigint,
  received_at timestamptz not null default now()
);

create index if not exists match_events_fixture_idx
  on match_events (fixture_id, id);

-- The current running state of a match, kept as one row per fixture so the
-- server can resolve questions and the screens can show the live score.
create table if not exists match_state (
  fixture_id text primary key references fixtures(id),
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row level security. Phones use the anon key and may only read. All writes go
-- through the server with the service role key, which bypasses these policies.
alter table fixtures     enable row level security;
alter table rooms        enable row level security;
alter table members      enable row level security;
alter table questions    enable row level security;
alter table answers      enable row level security;
alter table match_events enable row level security;
alter table match_state  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'fixtures', 'rooms', 'members', 'questions',
    'answers', 'match_events', 'match_state'
  ]
  loop
    execute format(
      'create policy %I on %I for select using (true)',
      t || '_read', t
    );
  end loop;
end $$;

-- Turn on Realtime so phones receive updates as rows change.
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table questions;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table match_events;
alter publication supabase_realtime add table match_state;
