-- Megapot social layer: ticket claim log (race board), community pools, contributions.

create table if not exists public.megapot_ticket_claims (
  id bigserial primary key,
  wallet text not null,
  ticket_id text not null,
  tx_hash text,
  inviter_wallet text,
  source text not null default 'treasury',
  created_at timestamptz not null default now()
);

create index if not exists megapot_ticket_claims_wallet_idx on public.megapot_ticket_claims (wallet);
create index if not exists megapot_ticket_claims_created_idx on public.megapot_ticket_claims (created_at desc);

alter table public.megapot_ticket_claims enable row level security;
drop policy if exists megapot_ticket_claims_service_only on public.megapot_ticket_claims;
create policy megapot_ticket_claims_service_only
  on public.megapot_ticket_claims for all to service_role
  using (true) with check (true);

-- Public read for race leaderboard (anon can select).
drop policy if exists megapot_ticket_claims_public_read on public.megapot_ticket_claims;
create policy megapot_ticket_claims_public_read
  on public.megapot_ticket_claims for select to anon, authenticated
  using (true);

-- Community ticket pools: members pool credits; operator buys tickets when threshold met.
create table if not exists public.megapot_ticket_pools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_public boolean not null default true,
  target_credits bigint not null default 1000 check (target_credits > 0),
  contributed_credits bigint not null default 0 check (contributed_credits >= 0),
  tickets_bought integer not null default 0,
  status text not null default 'open' check (status in ('open', 'buying', 'drawn', 'closed')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.megapot_pool_contributions (
  id bigserial primary key,
  pool_id uuid not null references public.megapot_ticket_pools(id) on delete cascade,
  wallet text not null,
  credits bigint not null check (credits > 0),
  created_at timestamptz not null default now()
);

create index if not exists megapot_pool_contrib_pool_idx on public.megapot_pool_contributions (pool_id);
create index if not exists megapot_pool_contrib_wallet_idx on public.megapot_pool_contributions (wallet);

alter table public.megapot_ticket_pools enable row level security;
alter table public.megapot_pool_contributions enable row level security;

drop policy if exists megapot_pools_public_read on public.megapot_ticket_pools;
create policy megapot_pools_public_read
  on public.megapot_ticket_pools for select to anon, authenticated
  using (true);

drop policy if exists megapot_pools_service on public.megapot_ticket_pools;
create policy megapot_pools_service
  on public.megapot_ticket_pools for all to service_role
  using (true) with check (true);

drop policy if exists megapot_pool_contrib_public_read on public.megapot_pool_contributions;
create policy megapot_pool_contrib_public_read
  on public.megapot_pool_contributions for select to anon, authenticated
  using (true);

drop policy if exists megapot_pool_contrib_service on public.megapot_pool_contributions;
create policy megapot_pool_contrib_service
  on public.megapot_pool_contributions for all to service_role
  using (true) with check (true);

-- Seed a default public community pool.
insert into public.megapot_ticket_pools (slug, name, description, is_public, target_credits)
values (
  'community-main',
  'Community Megapot Pool',
  'Pool credits with other players. Every 1000 credits buys a shared Megapot ticket for the active drawing.',
  true,
  1000
)
on conflict (slug) do nothing;
