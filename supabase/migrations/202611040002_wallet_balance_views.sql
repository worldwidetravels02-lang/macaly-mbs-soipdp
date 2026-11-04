-- Read-only wallet balance summaries derived from the immutable ledger.
-- Pending withdrawals are shown separately and are not treated as paid debits.

create or replace view public.wallet_balances
with (security_invoker = true)
as
select
  user_id,
  currency,
  coalesce(sum(case when direction = 'credit' and status = 'posted' then amount else 0 end), 0)::numeric(20,2) as total_credits,
  coalesce(sum(case when direction = 'debit' and status = 'posted' then amount else 0 end), 0)::numeric(20,2) as total_debits,
  (
    coalesce(sum(case when direction = 'credit' and status = 'posted' then amount else 0 end), 0)
    - coalesce(sum(case when direction = 'debit' and status = 'posted' then amount else 0 end), 0)
  )::numeric(20,2) as balance
from public.wallet_transactions
group by user_id, currency;

grant select on public.wallet_balances to authenticated;

create or replace view public.wallet_pending_withdrawals
with (security_invoker = true)
as
select
  user_id,
  currency,
  coalesce(sum(amount), 0)::numeric(20,2) as pending_amount,
  count(*)::bigint as pending_count
from public.withdrawal_requests
where status = 'pending'
group by user_id, currency;

grant select on public.wallet_pending_withdrawals to authenticated;

-- Tighten member-submitted withdrawal rows: members cannot pre-mark a request
-- reviewed or paid. Only admins may update request status through RLS.
drop policy if exists "Members submit pending withdrawal requests" on public.withdrawal_requests;
create policy "Members submit pending withdrawal requests"
on public.withdrawal_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and paid_at is null
);
