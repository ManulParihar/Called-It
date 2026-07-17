# Called It pool program

The Solana program that holds the stakes for a money room on devnet.

## What it does

- `create_pool` opens a pool with a stake, a payout mode, and the settlement key
  that is allowed to pay it out.
- `join_pool` takes a player's stake into the vault.
- `lock_pool` closes the pool to new joins at kickoff.
- `settle_pool` pays the winners the amounts the backend worked out from the
  match result. Only the settlement key can call it.
- `cancel_pool` refunds everyone if the match is voided.

The program never decides who won. It only holds the money and makes sure a
payout is never larger than the vault balance.

## Accounts

Each pool has a pool account (settings and status) and a vault (a plain system
account that holds the lamports). Both are found from seeds, so the backend can
derive their addresses from the room without storing them.

## Build and deploy

You need the Solana and Anchor toolchains. They are not part of the web app.

1. Install Rust, the Solana CLI, and Anchor (see the Anchor docs).
2. Point the Solana CLI at devnet and fund your keypair:
   - `solana config set --url devnet`
   - `solana airdrop 2`
3. From this folder, generate the program keypair and update the id:
   - `anchor keys sync`
   - This replaces the placeholder id in `Anchor.toml` and `lib.rs`.
4. Build and deploy:
   - `anchor build`
   - `anchor deploy`
5. Point the web app at the deployed program. The app builds the instructions
   itself, so there is no IDL to copy. Set these in `.env.local`:
   - `NEXT_PUBLIC_POOL_PROGRAM_ID` the deployed program id from step 3.
   - `NEXT_PUBLIC_SETTLEMENT_PUBKEY` the public key of the settlement authority.
   - `SETTLEMENT_AUTHORITY_SECRET` the matching secret key, base58 or a JSON byte
     array. Server only.
6. Check it end to end on devnet with `npm run escrow:devnet`. It stakes from two
   throwaway keypairs, then pays the pot out and confirms the vault emptied.

## Notes

Until the three variables above are set, the app runs the pot in mock mode: the
game plays through and logs the payout without any on chain transaction, which is
enough for local testing.

The settlement key is a backend keypair. Keep its secret in the server
environment as `SETTLEMENT_AUTHORITY_SECRET`. In this version the backend is
trusted to submit the correct standings. A later version can check the result
against the TxLINE on chain validation proofs so settlement does not need to be
trusted.
