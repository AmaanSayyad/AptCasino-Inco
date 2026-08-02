-- Ops/dashboard support: bans, account status, session dwell time, signature replay guard.

create table if not exists public.banned_wallets (
  wallet_address text primary key,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists banned_wallets_created_idx on public.banned_wallets (created_at desc);

create table if not exists public.wallet_account_status (
  wallet text primary key,
  status text not null default 'active'
    check (status in ('active', 'frozen', 'banned')),
  reason text,
  updated_at timestamptz not null default now()
);

create index if not exists wallet_account_status_status_idx on public.wallet_account_status (status);

-- Session dwell time for admin "Avg. time spent" (7-day rolling mean).
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  chain text not null default 'base-sepolia',
  started_at timestamptz not null default now(),
  last_ping_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists user_sessions_wallet_idx on public.user_sessions (wallet_address);
create index if not exists user_sessions_started_idx on public.user_sessions (started_at desc);
create index if not exists user_sessions_open_idx on public.user_sessions (wallet_address, last_ping_at)
  where ended_at is null;

-- Wallet-signature auth replay protection (KOL portal / profile edit auth, etc.).
create table if not exists public.wallet_auth_consumed (
  signature_hash text primary key,
  wallet text not null,
  chain text not null default 'base-sepolia',
  purpose text,
  consumed_at timestamptz not null default now()
);

create index if not exists wallet_auth_consumed_at_idx
  on public.wallet_auth_consumed (consumed_at desc);
