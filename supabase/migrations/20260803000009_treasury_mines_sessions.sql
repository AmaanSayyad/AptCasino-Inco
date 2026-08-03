-- Tracks which wallet owns which in-progress treasury-mediated Mines session. Needed
-- because the on-chain session.player is always the treasury wallet (it signs every
-- tx on the player's behalf) — the contract itself can't tell players apart, so this
-- table is what stops one treasury-session holder from revealing/cashing out another
-- player's pending session.
create table if not exists public.treasury_mines_sessions (
  game_id text primary key,
  wallet text not null,
  wager_raw bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists treasury_mines_sessions_wallet_idx on public.treasury_mines_sessions (wallet);

alter table public.treasury_mines_sessions enable row level security;

drop policy if exists treasury_mines_sessions_service_only on public.treasury_mines_sessions;
create policy treasury_mines_sessions_service_only
  on public.treasury_mines_sessions for all to service_role
  using (true) with check (true);
