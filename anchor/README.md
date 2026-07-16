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
5. Copy the generated IDL from `target/idl/called_it_pool.json` into the web app
   so the client can call the program.

## Notes

The settlement key is a backend keypair. Keep its secret in the server
environment as `SETTLEMENT_AUTHORITY_SECRET`. In this version the backend is
trusted to submit the correct standings. A later version can check the result
against the TxLINE on chain validation proofs so settlement does not need to be
trusted.
