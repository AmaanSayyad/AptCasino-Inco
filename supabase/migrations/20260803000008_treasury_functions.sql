-- Atomic balance mutations so concurrent requests for the same wallet can't race.
create or replace function public.treasury_credit(p_wallet text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  insert into public.treasury_balances (wallet, balance_raw, updated_at)
    values (p_wallet, p_amount, now())
    on conflict (wallet) do update
      set balance_raw = treasury_balances.balance_raw + excluded.balance_raw,
          updated_at = now()
    returning balance_raw into v_balance;
  return v_balance;
end;
$$;

-- Returns the new balance, or null if it would go negative (caller must treat null as "insufficient funds").
create or replace function public.treasury_debit(p_wallet text, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  update public.treasury_balances
    set balance_raw = balance_raw - p_amount, updated_at = now()
    where wallet = p_wallet and balance_raw >= p_amount
    returning balance_raw into v_balance;
  return v_balance;
end;
$$;

revoke all on function public.treasury_credit(text, bigint) from public;
revoke all on function public.treasury_debit(text, bigint) from public;
grant execute on function public.treasury_credit(text, bigint) to service_role;
grant execute on function public.treasury_debit(text, bigint) to service_role;
