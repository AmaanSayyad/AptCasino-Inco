-- Live streams (Livepeer/YouTube/HLS), session tracking, streamer reward workflow.

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  playback_id text not null,
  source text not null check (source in ('youtube', 'hls', 'livepeer')),
  wallet text not null,
  chain text not null default 'base-sepolia',
  title text,
  description text,
  is_approved boolean not null default false,
  session_status text not null default 'live' check (session_status in ('live', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  reward_tier_pct numeric(5,2) not null default 0,
  thumbnail_url text,
  x_handle text,
  telegram_username text,
  discord_handle text,
  payout_wallet text,
  reward_status text not null default 'pending'
    check (reward_status in ('pending', 'approved', 'paid', 'ineligible')),
  admin_reward_notes text,
  reward_paid_at timestamptz,
  reward_unlock_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint streams_playback_id_len check (char_length(playback_id) between 4 and 2048),
  constraint streams_wallet_len check (char_length(wallet) between 3 and 128)
);

comment on column public.streams.reward_unlock_at is 'Earliest time admin may pay streamer reward (14-day lock after session ends)';
comment on column public.streams.reward_tier_pct is 'Share of platform revenue: 0.1 (5+ min), 0.2 (15+ min), 0.3 (30+ min)';
comment on column public.streams.payout_wallet is 'Optional payout address for streamer rewards (chain-agnostic; Base Sepolia address in practice)';

create index if not exists streams_wallet_created_idx on public.streams (wallet, created_at desc);
create index if not exists streams_approved_created_idx on public.streams (is_approved, created_at desc);
create index if not exists streams_session_status_idx on public.streams (session_status, started_at desc);
create index if not exists streams_reward_status_idx on public.streams (reward_status, ended_at desc nulls last);
create index if not exists streams_wallet_live_idx on public.streams (wallet) where session_status = 'live';

alter table public.streams enable row level security;

drop policy if exists streams_select_approved on public.streams;
create policy streams_select_approved
  on public.streams for select to anon, authenticated
  using (is_approved = true);

drop policy if exists streams_service_write on public.streams;
create policy streams_service_write
  on public.streams for all to service_role
  using (true) with check (true);

-- Public bucket for stream thumbnails (API also auto-creates via service role if missing).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stream-thumbnails',
  'stream-thumbnails',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set public = true;

drop policy if exists stream_thumbnails_public_read on storage.objects;
create policy stream_thumbnails_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'stream-thumbnails');
