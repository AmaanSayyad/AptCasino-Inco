-- KOL partner allocations: password-gated portal showing an allocation/vesting schedule.
-- amount_aptc/pct_of_supply are legacy field names from the retired APTC token; the
-- table is kept because the KOL portal page is explicitly in scope, but Phase 2
-- should decide whether to relabel these fields for the current token-less product.

create table if not exists public.kol_allocations (
  id uuid primary key default gen_random_uuid(),
  kol_slug text not null,
  display_name text not null,
  wallet_address text not null,
  amount_aptc numeric(24, 6) not null default 1000000,
  pct_of_supply numeric(8, 4) not null default 0.1,
  lock_days integer not null default 14,
  cliff_days integer not null default 14,
  locked_at timestamptz not null default now(),
  unlock_at timestamptz not null,
  status text not null default 'locked'
    check (status in ('locked', 'ready', 'fulfilled', 'revoked')),
  portal_password_hash text not null,
  portal_password_plain text,
  fulfillment_tx_hash text,
  fulfilled_at timestamptz,
  x_handle text,
  country text,
  telegram text,
  avg_post_views integer,
  promotion_condition text,
  brought_by text,
  brought_on date,
  created_by text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kol_allocations_slug_unique unique (kol_slug)
);

comment on column public.kol_allocations.portal_password_plain is
  'Last known portal password for admin support; updated on create, admin reset, or KOL change.';
comment on column public.kol_allocations.cliff_days is
  'Cliff period in days from locked_at. Must be <= lock_days. unlock_at uses lock_days.';

create index if not exists kol_allocations_status_idx on public.kol_allocations (status);
create index if not exists kol_allocations_unlock_idx on public.kol_allocations (unlock_at);
create index if not exists kol_allocations_wallet_idx on public.kol_allocations (wallet_address);
