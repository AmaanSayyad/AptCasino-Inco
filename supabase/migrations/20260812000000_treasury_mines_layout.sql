-- The mine layout is fixed on-chain at commitMines and is a pure function of the
-- Inco-attested seed the treasury already holds at that moment. Storing it here lets a
-- tile click be answered immediately instead of waiting ~2s for the reveal tx's block;
-- the reveal tx is still broadcast and remains the source of truth for payouts.
--
-- Service-role only (RLS policy from the original migration still applies) — the layout
-- must never reach the player's browser before they pick.
alter table public.treasury_mines_sessions
  add column if not exists mine_positions smallint[],
  add column if not exists revealed_tiles smallint[] not null default '{}',
  -- revealTile() reserves liability incrementally and reverts once the projected payout
  -- exceeds the bankroll; this is the pick count that limit allows for this session.
  add column if not exists max_picks smallint;
