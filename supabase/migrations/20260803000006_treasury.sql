-- Custodial treasury balance ledger. Users deposit USDC to the treasury wallet once,
-- then play rounds against this off-chain balance (server signs the on-chain
-- play/settle transactions on their behalf using the treasury wallet).

create table if not exists public.treasury_balances (
  wallet text primary key,
  balance_raw bigint not null default 0 check (balance_raw >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.treasury_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  kind text not null check (kind in ('deposit', 'withdraw', 'wager', 'payout')),
  amount_raw bigint not null,
  game text check (game in ('roulette', 'wheel', 'plinko', 'mines')),
  tx_hash text,
  created_at timestamptz not null default now()
);

create unique index if not exists treasury_ledger_deposit_tx_idx
  on public.treasury_ledger (tx_hash)
  where kind = 'deposit' and tx_hash is not null;

create index if not exists treasury_ledger_wallet_idx on public.treasury_ledger (wallet, created_at desc);

alter table public.treasury_balances enable row level security;
alter table public.treasury_ledger enable row level security;

drop policy if exists treasury_balances_service_only on public.treasury_balances;
create policy treasury_balances_service_only
  on public.treasury_balances for all to service_role
  using (true) with check (true);

drop policy if exists treasury_ledger_service_only on public.treasury_ledger;
create policy treasury_ledger_service_only
  on public.treasury_ledger for all to service_role
  using (true) with check (true);
