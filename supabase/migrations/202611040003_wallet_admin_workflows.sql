-- Msheireb Properties: audited, atomic internal-wallet admin workflows.
-- These RPCs update internal ledger records only. They do not transfer real money.
-- Apply after 202611040001 and 202611040002.

create table if not exists public.financial_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.financial_audit_log enable row level security;
drop policy if exists "Admins read financial audit log" on public.financial_audit_log;
create policy "Admins read financial audit log"
on public.financial_audit_log for select to authenticated
using ((select private.is_admin()));

-- Remove direct admin status-edit policies. Admins must use the atomic RPCs below.
drop policy if exists "Admins manage topup requests" on public.topup_requests;
create policy "Admins read topup requests"
on public.topup_requests for select to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins manage withdrawal requests" on public.withdrawal_requests;
create policy "Admins read withdrawal requests"
on public.withdrawal_requests for select to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins manage profit payouts" on public.profit_payouts;
create policy "Admins read profit payouts"
on public.profit_payouts for select to authenticated
using ((select private.is_admin()));

create or replace function public.admin_review_topup(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.topup_requests%rowtype;
  v_transaction_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into v_request
  from public.topup_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Top-up request not found'; end if;
  if v_request.status <> 'pending' then
    raise exception 'Top-up request has already been reviewed';
  end if;

  update public.topup_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_note = p_admin_note,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;

  if p_approve then
    insert into public.wallet_transactions (
      user_id, transaction_type, direction, amount, currency, status,
      reference_type, reference_id, idempotency_key, description, created_by
    ) values (
      v_request.user_id, 'deposit', 'credit', v_request.amount, v_request.currency, 'posted',
      'topup_request', v_request.id, 'topup:' || v_request.id::text,
      'Approved customer top-up', (select auth.uid())
    )
    on conflict (idempotency_key) do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then
      raise exception 'A ledger entry already exists for this top-up';
    end if;
  end if;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_approve then 'topup_approved' else 'topup_rejected' end,
          'topup_request', v_request.id,
          jsonb_build_object('amount', v_request.amount, 'currency', v_request.currency, 'ledger_id', v_transaction_id));

  return v_transaction_id;
end;
$$;

create or replace function public.admin_review_withdrawal(
  p_request_id uuid,
  p_action text,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_requests%rowtype;
  v_transaction_id uuid;
  v_balance numeric(20,2);
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_action not in ('approve','reject','pay') then
    raise exception 'Action must be approve, reject or pay';
  end if;

  select * into v_request
  from public.withdrawal_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Withdrawal request not found'; end if;

  if p_action = 'reject' then
    if v_request.status <> 'pending' then raise exception 'Only pending requests can be rejected'; end if;
    update public.withdrawal_requests set status='rejected', admin_note=p_admin_note,
      reviewed_by=(select auth.uid()), reviewed_at=now(), updated_at=now()
    where id=p_request_id;
  elsif p_action = 'approve' then
    if v_request.status <> 'pending' then raise exception 'Only pending requests can be approved'; end if;
    update public.withdrawal_requests set status='approved', admin_note=p_admin_note,
      reviewed_by=(select auth.uid()), reviewed_at=now(), updated_at=now()
    where id=p_request_id;
  else
    if v_request.status <> 'approved' then raise exception 'Only approved requests can be marked paid'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_request.user_id::text || ':' || v_request.currency, 0));
    select coalesce(sum(case when direction='credit' then amount else -amount end),0)
      into v_balance
    from public.wallet_transactions
    where user_id=v_request.user_id and currency=v_request.currency and status='posted';

    if v_balance < v_request.amount then
      raise exception 'Insufficient wallet balance to mark this withdrawal paid';
    end if;

    insert into public.wallet_transactions (
      user_id, transaction_type, direction, amount, currency, status,
      reference_type, reference_id, idempotency_key, description, created_by
    ) values (
      v_request.user_id, 'withdrawal', 'debit', v_request.amount, v_request.currency, 'posted',
      'withdrawal_request', v_request.id, 'withdrawal:' || v_request.id::text,
      'Withdrawal marked paid by administrator', (select auth.uid())
    )
    on conflict (idempotency_key) do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then raise exception 'A ledger entry already exists for this withdrawal'; end if;

    update public.withdrawal_requests set status='paid', admin_note=coalesce(p_admin_note,admin_note),
      paid_at=now(), updated_at=now()
    where id=p_request_id;
  end if;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'withdrawal_' || p_action, 'withdrawal_request', v_request.id,
          jsonb_build_object('amount',v_request.amount,'currency',v_request.currency,'ledger_id',v_transaction_id));

  return v_transaction_id;
end;
$$;

create or replace function public.admin_credit_profit_payout(
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_period_start date,
  p_period_end date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout_id uuid;
  v_transaction_id uuid;
  v_key text;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if p_currency not in ('AED','OMR','SAR','KWD','BHD','QAR') then raise exception 'Unsupported currency'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid payout period';
  end if;
  if not exists (select 1 from auth.users where id=p_user_id) then raise exception 'Customer not found'; end if;

  v_key := 'profit:' || p_user_id::text || ':' || p_currency || ':' || p_period_start::text || ':' || p_period_end::text;

  insert into public.profit_payouts(user_id, period_start, period_end, amount, currency, status, idempotency_key, approved_by, approved_at)
  values (p_user_id, p_period_start, p_period_end, p_amount, p_currency, 'approved', v_key, (select auth.uid()), now())
  on conflict (idempotency_key) do nothing
  returning id into v_payout_id;

  if v_payout_id is null then raise exception 'A payout already exists for this customer and period'; end if;

  insert into public.wallet_transactions (
    user_id, transaction_type, direction, amount, currency, status,
    reference_type, reference_id, idempotency_key, description, created_by
  ) values (
    p_user_id, 'profit', 'credit', p_amount, p_currency, 'posted',
    'profit_payout', v_payout_id, v_key || ':ledger',
    coalesce(p_description,'Profit credited to customer wallet'), (select auth.uid())
  )
  returning id into v_transaction_id;

  update public.profit_payouts
  set status='credited', wallet_transaction_id=v_transaction_id, credited_at=now()
  where id=v_payout_id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'profit_credited', 'profit_payout', v_payout_id,
          jsonb_build_object('amount',p_amount,'currency',p_currency,'customer_id',p_user_id,'ledger_id',v_transaction_id));

  return v_transaction_id;
end;
$$;

revoke all on function public.admin_review_topup(uuid,boolean,text) from public, anon;
revoke all on function public.admin_review_withdrawal(uuid,text,text) from public, anon;
revoke all on function public.admin_credit_profit_payout(uuid,numeric,text,date,date,text) from public, anon;
grant execute on function public.admin_review_topup(uuid,boolean,text) to authenticated;
grant execute on function public.admin_review_withdrawal(uuid,text,text) to authenticated;
grant execute on function public.admin_credit_profit_payout(uuid,numeric,text,date,date,text) to authenticated;

grant select on public.financial_audit_log to authenticated;
