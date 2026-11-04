-- Enforce withdrawal limits in the database, not only in the browser.
-- Pending and approved requests reserve funds so multiple requests cannot
-- collectively exceed the customer's posted wallet balance.

create or replace function public.enforce_withdrawal_available_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric(20,2);
  v_reserved numeric(20,2);
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  if (select auth.uid()) is not null
     and new.user_id <> (select auth.uid())
     and not (select private.is_admin()) then
    raise exception 'You can only request a withdrawal from your own wallet'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.user_id::text || ':' || new.currency, 0)
  );

  select coalesce(sum(
    case when direction = 'credit' then amount else -amount end
  ), 0)
  into v_balance
  from public.wallet_transactions
  where user_id = new.user_id
    and currency = new.currency
    and status = 'posted';

  select coalesce(sum(amount), 0)
  into v_reserved
  from public.withdrawal_requests
  where user_id = new.user_id
    and currency = new.currency
    and status in ('pending', 'approved');

  if new.amount > v_balance - v_reserved then
    raise exception 'Withdrawal amount exceeds your available balance after pending requests';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_withdrawal_available_balance() from public, anon, authenticated;

drop trigger if exists enforce_withdrawal_available_balance on public.withdrawal_requests;
create trigger enforce_withdrawal_available_balance
before insert on public.withdrawal_requests
for each row
execute function public.enforce_withdrawal_available_balance();
