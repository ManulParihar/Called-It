-- Fixtures gain a kind so the create screen can tell three groups apart:
--   live     a match you can open a room on now (the default for existing rows)
--   replay   a real past match, replayed from its recorded timeline for testing
--   upcoming a future match shown for flavour only, not playable
-- Replay and upcoming rows that came from the TxLINE feed keep the source
-- fixture id so their recorded timeline can be found again.

alter table fixtures
  add column if not exists kind text not null default 'live'
    check (kind in ('live', 'replay', 'upcoming'));

alter table fixtures
  add column if not exists tx_fixture_id text;
