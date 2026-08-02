-- One wallet signature issues a session token valid for a while, so subsequent
-- treasury play/withdraw calls need no further per-round wallet signature.
create table if not exists public.treasury_sessions (
  token uuid primary key default gen_random_uuid(),
  wallet text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists treasury_sessions_wallet_idx on public.treasury_sessions (wallet);
create index if not exists treasury_sessions_expires_idx on public.treasury_sessions (expires_at);

alter table public.treasury_sessions enable row level security;

drop policy if exists treasury_sessions_service_only on public.treasury_sessions;
create policy treasury_sessions_service_only
  on public.treasury_sessions for all to service_role
  using (true) with check (true);
