# Called It

A group prediction game for live football. A friend creates a room, everyone
joins with a link, and each player answers the same five swipe questions about
an upcoming match. As the match plays out, the room reacts live to goals, cards,
and penalties. At full time a leaderboard shows who called it, and the pot pays
out or the loser owes the agreed forfeit.

## How a game works

1. One person creates a room and picks the wager.
   - Money: everyone stakes the same amount into a shared pot.
   - No money: the group agrees on a forfeit for the loser, such as buying pizza.
2. The app loads five questions for the chosen match. Four are worth one point
   each. The fifth is always "does team A win" and is worth three points.
3. Every player swipes right for yes or left for no, then locks in.
4. During the match the room updates live from the TxLINE data feed.
5. At full time the app scores everyone, shows the leaderboard, and settles the
   wager.

## Match data

Live scores and match events come from the TxLINE feed. The feed reports team
level events only (goals, cards, corners, penalties, and so on), so every
question is about a team or the match, never about a single player.

The feed is read on the server by a small worker. The worker keeps the TxLINE
credentials on the server, turns each incoming event into a normalized shape,
resolves any open questions, and writes the result to the database. Phones never
talk to TxLINE directly. They read updates from the database in real time.

The worker can also replay a recorded match log at a chosen speed. This is used
for demos so a full match can be shown in a couple of minutes without waiting
for a live fixture.

## The pot

When a room uses money, the stakes go into a Solana escrow program on devnet.
Players deposit when they join. At full time the backend computes the final
standings from the match result and asks the program to pay the winners. There
is also a cancel path that refunds everyone if a match is abandoned.

## Project layout

- `src/app` - Next.js app router pages and API routes.
- `src/lib` - shared game logic: types, question bank, scoring, payout.
- `src/server` - server only code: TxLINE client, worker, database access.
- `anchor` - the Solana escrow program.
- `test` - unit tests for the scoring and question logic.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the values.
3. Run the app with `npm run dev`.
4. Run the match worker with `npm run worker`.

## Scripts

- `npm run dev` - start the app in development.
- `npm run build` - build for production.
- `npm run typecheck` - type check without emitting files.
- `npm run test` - run the unit tests.
- `npm run worker` - run the TxLINE match worker.
