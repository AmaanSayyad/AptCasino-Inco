-- Referrals + public referral leaderboard.

create table if not exists public.referral_codes (
  code text primary key,
  wallet text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_referral_codes_wallet on public.referral_codes(wallet);

create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referrer_wallet text not null,
  referee_wallet text not null unique,
  code text not null,
  attributed_at timestamptz not null default now(),
  source text,
  user_agent text,
  is_valid boolean not null default false,
  first_deposit_at timestamptz,
  first_deposit_raw numeric(38, 0),
  first_deposit_tx_hash text,
  referrer_reward_raw numeric(38, 0) not null default 0,
  reward_status text not null default 'none'
    check (reward_status in ('none', 'locked', 'unlocked', 'paid', 'pending')),
  unlock_at timestamptz,
  referee_volume_usd numeric(20, 4) not null default 0,
  constraint chk_no_self_referral check (referrer_wallet <> referee_wallet)
);

create index if not exists idx_referrals_referrer on public.referrals(referrer_wallet, attributed_at desc);
create index if not exists idx_referrals_code on public.referrals(code);
create index if not exists idx_referrals_valid on public.referrals(referrer_wallet, is_valid, attributed_at desc);

create table if not exists public.referral_rewards_log (
  id bigint generated always as identity primary key,
  referrer_wallet text not null,
  referee_wallet text not null,
  code text not null,
  deposit_tx_hash text not null unique,
  deposit_raw numeric(38, 0) not null,
  reward_raw numeric(38, 0) not null,
  status text not null check (status in ('paid', 'pending', 'failed')),
  payout_tx_hash text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_rewards_referrer
  on public.referral_rewards_log(referrer_wallet, created_at desc);

-- Public leaderboard: include all invites, not only validated first deposits.
create or replace view public.referral_leaderboard as
select
  r.referrer_wallet as wallet,
  count(*)::int as total_referrals,
  count(*) filter (where r.is_valid)::int as referrals,
  coalesce(sum(case when r.is_valid then r.referrer_reward_raw else 0 end), 0)::numeric(38, 0) as earned_raw,
  min(r.attributed_at) as first_referral_at,
  max(coalesce(r.first_deposit_at, r.attributed_at)) as last_referral_at,
  rank() over (
    order by count(*) desc,
             count(*) filter (where r.is_valid) desc,
             min(r.attributed_at) asc nulls last
  )::int as rank
from public.referrals r
group by r.referrer_wallet
having count(*) > 0;
