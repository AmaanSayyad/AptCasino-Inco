-- AptCasino core schema (Base Sepolia era).
-- Trimmed rebuild of the original Aptos/Solana-era schema: keeps only what backs
-- profile, referral, leaderboard, kol portal, live streaming, competition, dashboard
-- and history. Staking, OTC lottery, IPO, litepaper, newsletter/roadmap CMS, the old
-- server-side house-balance ledger, and APTC-denominated bonus mechanics (cashback,
-- daily streak, deposit bonus, GGR buyback) are intentionally not carried forward —
-- there is no server-ledger deposit system in the current architecture.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Profiles & tracked wallets
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  wallet text primary key,
  handle text,
  handle_lower text generated always as (lower(handle)) stored,
  avatar_url text,
  bio text,
  twitter_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_user_profile_handle_len check (handle is null or char_length(handle) between 2 and 24),
  constraint chk_user_profile_bio_len check (bio is null or char_length(bio) <= 280),
  constraint chk_user_profile_twitter_len check (twitter_handle is null or char_length(twitter_handle) <= 32),
  constraint chk_user_profile_avatar_len check (avatar_url is null or char_length(avatar_url) <= 512)
);

create unique index if not exists user_profiles_handle_lower_unique
  on public.user_profiles (handle_lower)
  where handle_lower is not null;

create table if not exists public.tracked_wallets (
  wallet text primary key,
  chain text not null default 'base-sepolia',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists tracked_wallets_chain_idx on public.tracked_wallets (chain);

-- ---------------------------------------------------------------------------
-- Game history (mines/plinko/roulette/wheel), fairness display
-- ---------------------------------------------------------------------------

create table if not exists public.game_play_events (
  id uuid primary key default gen_random_uuid(),
  chain text not null default 'base-sepolia',
  game text not null check (game in ('plinko', 'mines', 'roulette', 'wheel')),
  wallet text not null,
  bet_raw bigint not null default 0,
  payout_raw bigint not null default 0,
  currency text not null default 'ETH',
  result text,
  fairness_proof jsonb,
  proof_reference text,
  created_at timestamptz not null default now()
);

create index if not exists game_play_events_chain_game_idx on public.game_play_events (chain, game);
create index if not exists game_play_events_created_idx on public.game_play_events (created_at desc);
create index if not exists game_play_events_wallet_idx on public.game_play_events (wallet);
create index if not exists game_play_events_proof_ref_idx
  on public.game_play_events (proof_reference)
  where proof_reference is not null;

comment on column public.game_play_events.fairness_proof is
  'Display-only fairness record (Inco attestation reference), not the source of truth for payout.';

alter table public.game_play_events enable row level security;

drop policy if exists game_play_events_service_only on public.game_play_events;
create policy game_play_events_service_only
  on public.game_play_events for all to service_role
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Tournaments / competitions
-- ---------------------------------------------------------------------------

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text not null check (game in ('plinko', 'mines', 'roulette', 'wheel', 'all')),
  prize_pool numeric not null default 0,
  entry_fee numeric not null default 0,
  max_participants integer not null default 100,
  starts_at timestamptz not null,
  ends_at timestamptz,
  included_games text[],
  competition_mode text not null default 'volume' check (competition_mode in ('volume', 'registration')),
  rewards_distributed_at timestamptz,
  notes text,
  status text not null default 'open' check (status in ('open', 'live', 'completed', 'cancelled', 'upcoming', 'ended')),
  created_at timestamptz not null default now()
);

create index if not exists tournaments_starts_at_idx on public.tournaments (starts_at);
create index if not exists tournaments_status_idx on public.tournaments (status);

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  wallet text not null,
  entry_fee_tx_hash text,
  entry_fee_amount numeric,
  prize_approved_at timestamptz,
  prize_tx_hash text,
  prize_amount numeric,
  registered_at timestamptz not null default now(),
  unique (tournament_id, wallet)
);

create index if not exists tournament_registrations_tournament_idx on public.tournament_registrations (tournament_id);
create index if not exists tournament_registrations_wallet_idx on public.tournament_registrations (wallet);
create unique index if not exists tournament_registrations_entry_fee_tx_idx
  on public.tournament_registrations (entry_fee_tx_hash)
  where entry_fee_tx_hash is not null;

comment on column public.tournament_registrations.entry_fee_tx_hash is
  'Base Sepolia transaction hash for the entry fee payment.';
comment on column public.tournament_registrations.prize_approved_at is
  'Set when admin manually approves and records prize payout for this registrant.';
