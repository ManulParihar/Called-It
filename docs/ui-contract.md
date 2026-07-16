# UI contract and brief

This is the guide for building the screens. The backend is done and works. The
screens should call the helpers listed here and never talk to the database or
the match feed directly.

## What to build with

- Next.js App Router, mobile first. Pages live in `src/app`.
- Call the API through `src/lib/api.ts`. It has typed functions for every action.
- Get live updates through `src/lib/realtime.ts` (`subscribeRoom`). When it fires,
  refetch the room with `getRoom(code)` or update local state.
- Read live numbers with `src/lib/live.ts`: `liveLeaderboard`, `potCents`,
  `projectedPayouts`, `hasAnswered`, `membersStillToAnswer`. These reuse the same
  scoring the server settles with, so the screen and the payout always agree.
- Character roster: `src/lib/mascots.ts`. Default forfeits: `src/lib/forfeits.ts`.
- Every shape you need is in `src/lib/types.ts` (`Room`, `Member`, `Question`,
  `Answer`, `RoomBundle`, `LeaderboardEntry`, `PayoutShare`).

There is no auth wiring yet. For now, make a `userId` on the device (a random id
kept in local storage is fine) and pass it in. The embedded wallet sign in and
Solana deposit can be layered on later; the API already accepts an optional
`walletAddress`.

## The screens

1. Sign in and pick a character. Create a device `userId` and let the player pick
   a mascot from `MASCOTS`.
2. Lobby. Create a room, or join with a code or link.
3. Create room. Pick the fixture from `listFixtures()`, pick which side is team A,
   pick money or forfeit. Money: stake `0` to `100` in steps of `10` on a slot
   style roller, and a payout mode. Forfeit: a default from `DEFAULT_FORFEITS` or
   a custom line. Then call `createRoom`.
4. Join. Show the wager and who is in from `getRoom(code)`, then `joinRoom`.
5. Predict. Show the five questions as swipe cards, right for yes and left for no.
   Slot five is the three point card and should stand out. Call `submitAnswers`
   with all five, then it is locked.
6. Waiting room. Show members and answer progress with `membersStillToAnswer`,
   count down to `room.lockAt`.
7. Live. The main screen. Subscribe with `subscribeRoom`. Show the score from the
   `match_state` row, a ticker from `match_events`, and the running order from
   `liveLeaderboard`. React to each event: goals, cards, penalties, and so on.
8. Full time. When `room.status` becomes `settled`, show the final
   `liveLeaderboard`. Money rooms: show `projectedPayouts` as the final split.
   Forfeit rooms: call out the loser (`entry.isLoser`) and read the forfeit
   (`room.forfeitText`).

## Scoring, for display

- Four one point questions and one three point question, so seven points max.
- A question shows as pending until the match resolves it, then yes or no.
- A player earns a question's points when their swipe matches the outcome.
- Ties share a rank. Everyone on the top score is a winner. The lowest score is
  the loser, unless everyone is tied.

## Payout modes, for display

- `winner_takes_all`: the top score takes the pot, tied winners split it.
- `top_three`: the top three split fifty, thirty, twenty.
- `all_but_loser`: everyone except the loser shares by their points.

## Match events to react to

`match_events` rows have a `kind`: `phase_change`, `goal`, `yellow_card`,
`red_card`, `corner`, `penalty_awarded`, `var_review`, `substitution`. Goals and
cards carry a `team` of `home` or `away`. Phase changes carry a `phase`. The big
moments to make loud are goals, red cards, and penalties.

## The look and feel (from the product brief)

- It is a mobile game, so it should feel animated and alive, with characters and
  strong colour, not a plain form app.
- Art direction is a lucha arcade: masked animal characters and a host referee
  who reacts to the match and reads out the loser's forfeit at the end.
- Do not use generic corporate colours. Pick a bold, unexpected palette.
- Sounds and read aloud voice come later, so leave room for them but do not block
  on them.

## Demo path

Seed fixtures with `npm run seed`, create a room on the `fx-sample` fixture, then
run `TXLINE_REPLAY=true REPLAY_FIXTURE_ID=fx-sample npm run worker`. The recorded
match plays out fast: it ends three to two to the home side with a late winner, a
red card, a penalty, and a VAR review, so the live screen has plenty to react to.
