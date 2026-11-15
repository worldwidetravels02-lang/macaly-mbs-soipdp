-- Admin dashboard total of commissions actually posted to customer wallets today.
-- The reporting day follows Oman local time (UTC+4), independently of database timezone.
create or replace function public.admin_today_commission_revenue()
returns table(currency text, total_amount numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select wt.currency, coalesce(sum(wt.amount), 0)::numeric as total_amount
  from public.wallet_transactions as wt
  where (select private.is_admin())
    and wt.transaction_type = 'commission'
    and wt.direction = 'credit'
    and wt.status = 'posted'
    and wt.created_at >= (
      (now() at time zone 'Asia/Muscat')::date::timestamp
      at time zone 'Asia/Muscat'
    )
    and wt.created_at < (
      (((now() at time zone 'Asia/Muscat')::date + 1)::timestamp)
      at time zone 'Asia/Muscat'
    )
  group by wt.currency
  order by wt.currency;
$$;

revoke all on function public.admin_today_commission_revenue() from public, anon;
grant execute on function public.admin_today_commission_revenue() to authenticated;
