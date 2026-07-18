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
A fresh pool account is created for every room. Players deposit when they
join. At full time the backend computes the final standings from the match
result and asks the program to pay the winners. There is also a cancel path
that refunds everyone if a match is abandoned. Until the program id and a
settlement key are configured, the app runs the pot in mock mode with no on
chain transactions, so the game is fully playable without Solana set up.

## Wallets

Players sign in with a Privy embedded wallet (email or social login, no
extension needed). Local testing uses a throwaway browser keypair instead, so
`NEXT_PUBLIC_PRIVY_APP_ID` can stay blank while developing. Whichever wallet is
active, its balance and recent activity are visible from the settings menu
(top right gear icon), each transaction linking out to the Solana block
explorer.

## Project layout

- `src/app` - Next.js app router pages and API routes.
- `src/lib` - shared game logic: types, question bank, scoring, payout.
- `src/server` - server only code: TxLINE client, worker, database access.
- `anchor` - the Solana escrow program.
- `test` - unit tests for the scoring and question logic.

## Database

The schema lives in `supabase/migrations`. Apply it to a fresh Supabase
project either by pasting the SQL file into the project's SQL editor, or by
connecting the repo through Supabase's GitHub integration, which applies new
migrations on every push to `main`.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the values.
3. Apply the schema in `supabase/migrations` to your Supabase project.
4. Run the app with `npm run dev`.
5. Seed a couple of fixtures with `npm run seed`.
6. Run the match worker with `npm run worker`.

## Local mode without Supabase

For quick testing you can run the whole app with no hosted database at all. In
this mode every table is kept in a single JSON file, `.local-db.json`, that all
the processes share. Realtime is turned off, so the room screens fall back to
polling, which is enough to watch a game move.

1. Seed the fixtures into the local file with `npm run seed:local`.
2. Start the app with `npm run local`.
3. Replay a match with `npm run worker:local`.

Delete `.local-db.json` any time you want a clean slate. The file is ignored by
git so it never gets committed.

## Scripts

- `npm run dev` - start the app in development.
- `npm run local` - start the app in local mode, backed by a JSON file.
- `npm run mobile` - start the app and print a QR code for testing on a phone.
- `npm run build` - build for production.
- `npm run typecheck` - type check without emitting files.
- `npm run test` - run the unit tests.
- `npm run worker` - run the TxLINE match worker.
- `npm run worker:local` - run the match worker against the local JSON file.
- `npm run seed` - add sample fixtures to Supabase.
- `npm run seed:local` - add sample fixtures to the local JSON file.
- `npm run pull:replays` - pull finished matches from TxLINE to replay later.
- `npm run escrow:devnet` - exercise the pool program on devnet end to end.
- `npm run txline:activate` - activate a persistent TxLINE API token.
