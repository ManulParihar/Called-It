-- Replay fixtures store their recorded timeline right on the row.
--
-- The pull:replays script writes each timeline to data/replays/<id>.jsonl for
-- local use, but a serverless host has a read only filesystem, so the in app
-- refresh button cannot write those files. Keeping the timeline here means a
-- fixture pulled at runtime is fully self contained: the simulator reads its
-- lines straight from the row, no bundled file needed.
alter table fixtures
  add column if not exists replay_log jsonb;
