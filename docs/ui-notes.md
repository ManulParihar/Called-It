# UI notes

Notes from building the screens, including small backend asks. Nothing here
blocks the game; these are quality of life items.

## Match state snapshot on load

`getRoom` does not include the current `match_state`, and the realtime channel
only delivers changes. The live screen therefore starts from
`initialMatchState` and catches up on the first realtime update. That is fine
for the replay demo (the room exists before the match starts), but a phone that
opens mid match shows 0:0 until the next state change lands. A small API
endpoint that returns the current match state for a fixture (or folding it into
the room bundle) would fix that.

## Recent events on load

Same story for `match_events`: only new rows arrive over realtime, so the
ticker starts empty on a reload mid match. An endpoint for the last N events of
a fixture would let the ticker backfill.

## Deposits

`Member.depositState` exists but there is no deposit flow yet, so the screens
do not surface it. When the wallet flow lands, the waiting room is the natural
place to show who has paid in.
