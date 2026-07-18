// The escrow program for a money room.
//
// A room's stakes live in a vault owned by the program until the match is over.
// Players deposit an equal stake when they join. When the match ends, the
// backend settlement key asks the program to pay the winners the amounts it
// worked out from the result. If the match is voided, the same key refunds
// everyone. The program never decides who won; it only holds the money and
// checks that a payout never exceeds what is in the vault.
//
// One pool has two accounts:
//   - the pool account, which holds the settings and status
//   - the vault, a plain system account that holds the lamports

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("mV4Xe9uYS1osszQZiWMTFsQWvotqcqL9dGsNXdMNKFf");

#[program]
pub mod called_it_pool {
    use super::*;

    // Opens a pool. The creator sets the stake, the payout mode, and the
    // settlement key that is allowed to pay the pool out later.
    pub fn create_pool(
        ctx: Context<CreatePool>,
        room_seed: [u8; 16],
        stake_lamports: u64,
        distribution_mode: u8,
        settlement_authority: Pubkey,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.creator = ctx.accounts.creator.key();
        pool.authority = settlement_authority;
        pool.room_seed = room_seed;
        pool.stake_lamports = stake_lamports;
        pool.distribution_mode = distribution_mode;
        pool.status = PoolStatus::Open as u8;
        pool.total_deposited = 0;
        pool.member_count = 0;
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    // A player deposits their stake into the vault. Only allowed while the pool
    // is open.
    pub fn join_pool(ctx: Context<JoinPool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open as u8, PoolError::NotOpen);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.member.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            pool.stake_lamports,
        )?;

        pool.total_deposited = pool
            .total_deposited
            .checked_add(pool.stake_lamports)
            .ok_or(PoolError::MathOverflow)?;
        pool.member_count = pool.member_count.checked_add(1).ok_or(PoolError::MathOverflow)?;
        Ok(())
    }

    // Closes the pool to new joins at kickoff. Either the creator or the
    // settlement key can call this.
    pub fn lock_pool(ctx: Context<ManagePool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open as u8, PoolError::NotOpen);
        require!(
            ctx.accounts.signer.key() == pool.creator
                || ctx.accounts.signer.key() == pool.authority,
            PoolError::NotAllowed
        );
        pool.status = PoolStatus::Locked as u8;
        Ok(())
    }

    // Pays the winners. The amounts are worked out by the backend from the
    // match result. The recipient accounts are passed in the same order as the
    // amounts. Only the settlement key can call this.
    pub fn settle_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleOrCancel<'info>>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        require!(
            ctx.accounts.signer.key() == ctx.accounts.pool.authority,
            PoolError::NotAllowed
        );
        require!(
            ctx.accounts.pool.status == PoolStatus::Open as u8
                || ctx.accounts.pool.status == PoolStatus::Locked as u8,
            PoolError::AlreadyFinished
        );

        pay_out(&ctx, &amounts)?;
        ctx.accounts.pool.status = PoolStatus::Settled as u8;
        Ok(())
    }

    // Refunds everyone when a match is voided. The creator or the settlement key
    // can call this.
    pub fn cancel_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleOrCancel<'info>>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        require!(
            ctx.accounts.signer.key() == ctx.accounts.pool.creator
                || ctx.accounts.signer.key() == ctx.accounts.pool.authority,
            PoolError::NotAllowed
        );
        require!(
            ctx.accounts.pool.status != PoolStatus::Settled as u8,
            PoolError::AlreadyFinished
        );

        pay_out(&ctx, &amounts)?;
        ctx.accounts.pool.status = PoolStatus::Cancelled as u8;
        Ok(())
    }
}

// Moves lamports from the vault to each recipient. The recipients come in as
// remaining accounts in the same order as the amounts. The total can never be
// more than what the vault holds.
fn pay_out<'info>(ctx: &Context<'_, '_, '_, 'info, SettleOrCancel<'info>>, amounts: &[u64]) -> Result<()> {
    let recipients = ctx.remaining_accounts;
    require!(recipients.len() == amounts.len(), PoolError::CountMismatch);

    let mut total: u64 = 0;
    for amount in amounts {
        total = total.checked_add(*amount).ok_or(PoolError::MathOverflow)?;
    }
    require!(
        ctx.accounts.vault.lamports() >= total,
        PoolError::InsufficientFunds
    );

    let pool_key = ctx.accounts.pool.key();
    let vault_seeds: &[&[u8]] = &[b"vault", pool_key.as_ref(), &[ctx.accounts.pool.vault_bump]];

    for (recipient, amount) in recipients.iter().zip(amounts.iter()) {
        if *amount == 0 {
            continue;
        }
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: recipient.clone(),
                },
                &[vault_seeds],
            ),
            *amount,
        )?;
    }
    Ok(())
}

#[derive(Accounts)]
#[instruction(room_seed: [u8; 16])]
pub struct CreatePool<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Pool::SIZE,
        seeds = [b"pool", creator.key().as_ref(), room_seed.as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    /// The vault is a plain system account. It holds the stakes and is funded by
    /// deposits, so it is not created here.
    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinPool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManagePool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleOrCancel<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Pool {
    pub creator: Pubkey,
    pub authority: Pubkey,
    pub room_seed: [u8; 16],
    pub stake_lamports: u64,
    pub distribution_mode: u8,
    pub status: u8,
    pub total_deposited: u64,
    pub member_count: u32,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Pool {
    // 32 + 32 + 16 + 8 + 1 + 1 + 8 + 4 + 1 + 1
    pub const SIZE: usize = 104;
}

#[repr(u8)]
pub enum PoolStatus {
    Open = 0,
    Locked = 1,
    Settled = 2,
    Cancelled = 3,
}

#[error_code]
pub enum PoolError {
    #[msg("The pool is not open")]
    NotOpen,
    #[msg("You are not allowed to do that")]
    NotAllowed,
    #[msg("The pool is already settled or cancelled")]
    AlreadyFinished,
    #[msg("The number of amounts does not match the number of recipients")]
    CountMismatch,
    #[msg("The vault does not hold enough to cover this payout")]
    InsufficientFunds,
    #[msg("A number overflowed")]
    MathOverflow,
}
