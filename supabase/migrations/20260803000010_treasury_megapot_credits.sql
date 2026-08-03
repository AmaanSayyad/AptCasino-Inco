-- Off-chain per-user Megapot credit ledger for custodial ("house balance") play.
-- On-chain, AptCasino.sol records msg.sender (the treasury signer) as the credited
-- player for custodial rounds, so real Megapot credits pool under the treasury's own
-- address, not the individual user's. This table mirrors the exact same accrual
-- formula per real wallet so each house-balance player can still earn and claim their
-- own ticket — MegapotRewardVault.claimTicketFor(player) spends from the treasury's
-- pooled on-chain balance and mints the ticket directly to that player's wallet.

create table if not exists public.treasury_megapot_credits (
  wallet text primary key,
  credits bigint not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.treasury_megapot_credits enable row level security;

drop policy if exists treasury_megapot_credits_service_only on public.treasury_megapot_credits;
create policy treasury_megapot_credits_service_only
  on public.treasury_megapot_credits for all to service_role
  using (true) with check (true);

create or replace function public.treasury_megapot_award(p_wallet text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits bigint;
begin
  insert into public.treasury_megapot_credits (wallet, credits, updated_at)
    values (p_wallet, p_amount, now())
    on conflict (wallet) do update
      set credits = treasury_megapot_credits.credits + excluded.credits,
          updated_at = now()
    returning credits into v_credits;
  return v_credits;
end;
$$;

-- Returns the new balance, or null if it would go negative (caller must treat null as "not enough credits").
create or replace function public.treasury_megapot_debit(p_wallet text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits bigint;
begin
  update public.treasury_megapot_credits
    set credits = credits - p_amount, updated_at = now()
    where wallet = p_wallet and credits >= p_amount
    returning credits into v_credits;
  return v_credits;
end;
$$;

revoke all on function public.treasury_megapot_award(text, bigint) from public;
revoke all on function public.treasury_megapot_debit(text, bigint) from public;
grant execute on function public.treasury_megapot_award(text, bigint) to service_role;
grant execute on function public.treasury_megapot_debit(text, bigint) to service_role;
