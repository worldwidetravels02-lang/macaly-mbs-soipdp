-- Msheireb Properties: complete admin-reviewed investment funding and commission ledger.
-- All balances remain internal ledger records. No external payment or guaranteed return is created here.

-- Add INR consistently to the internal wallet and request ledgers.
alter table public.wallet_transactions drop constraint if exists wallet_transactions_currency_check;
alter table public.wallet_transactions add constraint wallet_transactions_currency_check
  check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','INR'));
alter table public.topup_requests drop constraint if exists topup_requests_currency_check;
alter table public.topup_requests add constraint topup_requests_currency_check
  check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','INR'));
alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_currency_check;
alter table public.withdrawal_requests add constraint withdrawal_requests_currency_check
  check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','INR'));
alter table public.investments drop constraint if exists investments_currency_check;
alter table public.investments add constraint investments_currency_check
  check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','INR'));
alter table public.profit_payouts drop constraint if exists profit_payouts_currency_check;
alter table public.profit_payouts add constraint profit_payouts_currency_check
  check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','INR'));

alter table public.wallet_transactions drop constraint if exists wallet_transactions_transaction_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_transaction_type_check
  check (transaction_type in ('deposit','withdrawal','investment_funding','profit','commission','admin_credit','admin_debit','refund','adjustment'));

alter table public.investment_requests
  add column if not exists currency text not null default 'AED';
alter table public.investment_requests
  drop constraint if exists investment_requests_currency_check;
alter table public.investment_requests
  add constraint investment_requests_currency_check
  check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','INR'));
alter table public.investment_requests
  add column if not exists plan_id uuid references public.membership_plans(id) on delete set null,
  add column if not exists profit_percent numeric(8,4) not null default 0 check (profit_percent >= 0 and profit_percent <= 100),
  add column if not exists commission_percent numeric(8,4) not null default 0 check (commission_percent >= 0 and commission_percent <= 100);

create table if not exists public.commission_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  source_user_id uuid references auth.users(id) on delete set null,
  plan_id uuid references public.membership_plans(id) on delete set null,
  commission_type text not null check (commission_type in ('referral','property','investment','sales','other')),
  reference text,
  base_amount numeric(20,2) not null check (base_amount > 0),
  commission_percent numeric(8,4) not null check (commission_percent > 0 and commission_percent <= 100),
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'AED' check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','INR')),
  status text not null default 'pending' check (status in ('pending','credited','rejected')),
  description text,
  admin_note text,
  idempotency_key text not null unique,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  credited_at timestamptz
);

create index if not exists commission_records_user_created_idx
  on public.commission_records(user_id, created_at desc);
create index if not exists commission_records_status_created_idx
  on public.commission_records(status, created_at desc);

alter table public.commission_records enable row level security;
drop policy if exists "Members read own commission records" on public.commission_records;
create policy "Members read own commission records"
  on public.commission_records for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on public.commission_records from anon, authenticated;
grant select on public.commission_records to authenticated;

create or replace function public.admin_create_commission(
  p_user_id uuid,
  p_plan_id uuid,
  p_base_amount numeric,
  p_currency text default 'AED',
  p_commission_type text default 'referral',
  p_source_user_id uuid default null,
  p_reference text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate numeric(8,4);
  v_amount numeric(20,2);
  v_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Select a valid commission recipient';
  end if;
  if p_source_user_id is not null and not exists (select 1 from auth.users where id = p_source_user_id) then
    raise exception 'The source customer account does not exist';
  end if;
  if p_base_amount is null or p_base_amount <= 0 or p_base_amount > 100000000 then
    raise exception 'Commission base amount must be greater than zero and within the allowed limit';
  end if;
  if p_currency not in ('AED','OMR','SAR','KWD','BHD','QAR','INR') then
    raise exception 'Unsupported currency';
  end if;
  if p_commission_type not in ('referral','property','investment','sales','other') then
    raise exception 'Unsupported commission type';
  end if;

  select commission_percent into v_rate
  from public.membership_plans
  where id = p_plan_id and active = true;
  if v_rate is null or v_rate <= 0 or v_rate > 100 then
    raise exception 'Choose an active plan with a valid commission percentage';
  end if;

  v_amount := round(p_base_amount * v_rate / 100, 2);
  if v_amount <= 0 then
    raise exception 'Calculated commission is below the minimum credit amount';
  end if;

  insert into public.commission_records(
    user_id, source_user_id, plan_id, commission_type, reference,
    base_amount, commission_percent, amount, currency, status,
    description, idempotency_key, created_by
  ) values (
    p_user_id, p_source_user_id, p_plan_id, p_commission_type,
    nullif(btrim(p_reference), ''), p_base_amount, v_rate, v_amount,
    p_currency, 'pending', nullif(btrim(p_description), ''),
    'commission:' || gen_random_uuid()::text, (select auth.uid())
  )
  returning id into v_id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'commission_created', 'commission_record', v_id,
    jsonb_build_object('user_id', p_user_id, 'base_amount', p_base_amount,
      'commission_percent', v_rate, 'amount', v_amount, 'currency', p_currency,
      'commission_type', p_commission_type));

  return v_id;
end;
$$;

create or replace function public.admin_review_commission(
  p_commission_id uuid,
  p_action text,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commission public.commission_records%rowtype;
  v_transaction_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_action not in ('credit','reject') then
    raise exception 'Choose credit or reject';
  end if;

  select * into v_commission
  from public.commission_records
  where id = p_commission_id
  for update;
  if not found then raise exception 'Commission record not found'; end if;
  if v_commission.status <> 'pending' then
    raise exception 'Only pending commission records can be reviewed';
  end if;

  if p_action = 'credit' then
    insert into public.wallet_transactions(
      user_id, transaction_type, direction, amount, currency, status,
      reference_type, reference_id, idempotency_key, description, created_by, metadata
    ) values (
      v_commission.user_id, 'commission', 'credit', v_commission.amount,
      v_commission.currency, 'posted', 'commission_record', v_commission.id,
      'commission-credit:' || v_commission.id::text,
      coalesce(nullif(btrim(p_admin_note), ''), v_commission.description, 'Approved commission'),
      (select auth.uid()),
      jsonb_build_object('commission_type', v_commission.commission_type,
        'base_amount', v_commission.base_amount,
        'commission_percent', v_commission.commission_percent)
    )
    returning id into v_transaction_id;

    update public.commission_records
    set status = 'credited', admin_note = nullif(btrim(p_admin_note), ''),
        reviewed_by = (select auth.uid()), reviewed_at = now(),
        credited_at = now(), wallet_transaction_id = v_transaction_id
    where id = v_commission.id;
  else
    update public.commission_records
    set status = 'rejected', admin_note = nullif(btrim(p_admin_note), ''),
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = v_commission.id;
  end if;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'commission_' || p_action, 'commission_record',
    v_commission.id, jsonb_build_object('user_id', v_commission.user_id,
      'amount', v_commission.amount, 'currency', v_commission.currency,
      'wallet_transaction_id', v_transaction_id, 'admin_note', p_admin_note));

  return v_transaction_id;
end;
$$;

create or replace function public.admin_review_investment_request(
  p_request_id uuid,
  p_action text,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $
declare
  v_request public.investment_requests%rowtype;
  v_plan_id uuid;
  v_minimum numeric(20,2);
  v_profit_percent numeric(8,4);
  v_commission_percent numeric(8,4);
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_action not in ('approve','reject') then
    raise exception 'Choose approve or reject';
  end if;
  select * into v_request from public.investment_requests
  where id = p_request_id for update;
  if not found then raise exception 'Investment request not found'; end if;
  if v_request.status <> 'pending' then
    raise exception 'Only pending investment requests can be reviewed';
  end if;

  if p_action = 'approve' then
    select id, minimum_amount, profit_percent, commission_percent
      into v_plan_id, v_minimum, v_profit_percent, v_commission_percent
    from public.membership_plans
    where code = v_request.plan_code and active = true;
    if v_plan_id is null then raise exception 'The selected investment plan is no longer active'; end if;
    if v_request.amount < v_minimum then
      raise exception 'The investment amount is below the current plan minimum';
    end if;
    update public.investment_requests
    set status = 'approved',
        plan_id = v_plan_id,
        profit_percent = v_profit_percent,
        commission_percent = v_commission_percent,
        expected_profit = round(v_request.amount * v_profit_percent / 100, 2),
        expected_commission = round(v_request.amount * v_commission_percent / 100, 2),
        admin_note = nullif(btrim(p_admin_note), ''),
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where id = v_request.id;
  else
    update public.investment_requests
    set status = 'rejected',
        admin_note = nullif(btrim(p_admin_note), ''),
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where id = v_request.id;
  end if;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'investment_request_' || p_action, 'investment_request',
    v_request.id, jsonb_build_object('user_id', v_request.user_id,
      'amount', v_request.amount, 'currency', v_request.currency,
      'plan_code', v_request.plan_code, 'admin_note', p_admin_note));
  return v_request.id;
end;
$$;

create or replace function public.admin_fund_investment_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.investment_requests%rowtype;
  v_balance numeric(20,2);
  v_transaction_id uuid;
  v_investment_id uuid;
  v_commission_amount numeric(20,2);
  v_commission_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into v_request
  from public.investment_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Investment request not found'; end if;
  if v_request.status <> 'approved' then
    raise exception 'Only approved investment requests can be funded';
  end if;

  select coalesce(balance, 0) into v_balance
  from public.wallet_balances
  where user_id = v_request.user_id and currency = v_request.currency;
  if coalesce(v_balance, 0) < v_request.amount then
    raise exception 'Customer does not have enough posted wallet balance in %', v_request.currency;
  end if;

  insert into public.wallet_transactions(
    user_id, transaction_type, direction, amount, currency, status,
    reference_type, reference_id, idempotency_key, description, created_by, metadata
  ) values (
    v_request.user_id, 'investment_funding', 'debit', v_request.amount,
    v_request.currency, 'posted', 'investment_request', v_request.id,
    'investment-funding:' || v_request.id::text,
    'Investment funded: ' || v_request.property_name, (select auth.uid()),
    jsonb_build_object('property_id', v_request.property_id, 'plan_code', v_request.plan_code)
  )
  returning id into v_transaction_id;

  insert into public.investments(
    user_id, property_id, amount, currency, status, reference,
    admin_note, approved_by, approved_at
  ) values (
    v_request.user_id, v_request.property_id, v_request.amount, v_request.currency,
    'funded', 'request:' || v_request.id::text, v_request.admin_note,
    (select auth.uid()), now()
  )
  returning id into v_investment_id;

  v_commission_amount := round(v_request.amount * coalesce(v_request.commission_percent, 0) / 100, 2);
  if v_commission_amount > 0 then
    insert into public.commission_records(
      user_id, plan_id, commission_type, reference, base_amount,
      commission_percent, amount, currency, status, description,
      idempotency_key, created_by
    ) values (
      v_request.user_id, v_request.plan_id, 'investment',
      'investment-request:' || v_request.id::text, v_request.amount,
      v_request.commission_percent, v_commission_amount, v_request.currency,
      'pending', 'Investment commission awaiting administrator review',
      'investment-commission:' || v_request.id::text, (select auth.uid())
    ) returning id into v_commission_id;
  end if;

  update public.investment_requests
  set status = 'funded', funded_at = now(), wallet_transaction_id = v_transaction_id
  where id = v_request.id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'investment_funded', 'investment_request',
    v_request.id, jsonb_build_object('investment_id', v_investment_id,
      'wallet_transaction_id', v_transaction_id, 'commission_record_id', v_commission_id,
      'amount', v_request.amount, 'currency', v_request.currency));

  return v_transaction_id;
end;
$$;

revoke all on function public.admin_create_commission(uuid,uuid,numeric,text,text,uuid,text,text) from public, anon;
revoke all on function public.admin_review_investment_request(uuid,text,text) from public, anon;
revoke all on function public.admin_review_commission(uuid,text,text) from public, anon;
revoke all on function public.admin_fund_investment_request(uuid) from public, anon;
grant execute on function public.admin_create_commission(uuid,uuid,numeric,text,text,uuid,text,text) to authenticated;
grant execute on function public.admin_review_investment_request(uuid,text,text) to authenticated;
grant execute on function public.admin_review_commission(uuid,text,text) to authenticated;
grant execute on function public.admin_fund_investment_request(uuid) to authenticated;


-- Keep plan percentages within the same bounds enforced by the administration UI.
alter table public.membership_plans
  drop constraint if exists membership_plans_profit_percent_check;
alter table public.membership_plans
  add constraint membership_plans_profit_percent_check
  check (profit_percent >= 0 and profit_percent <= 100);
alter table public.membership_plans
  drop constraint if exists membership_plans_commission_percent_check;
alter table public.membership_plans
  add constraint membership_plans_commission_percent_check
  check (commission_percent >= 0 and commission_percent <= 100);

-- Extend the existing administrator wallet-credit RPCs to accept INR as well.
create or replace function public.admin_add_wallet_balance(
  p_user_id uuid,
  p_amount numeric,
  p_currency text default 'AED',
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_description text;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Select a valid customer';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Amount must be greater than zero and no more than 100,000,000';
  end if;
  if p_currency not in ('AED','OMR','SAR','KWD','BHD','QAR','INR') then
    raise exception 'Unsupported currency';
  end if;
  v_description := coalesce(nullif(btrim(p_description), ''), 'Wallet balance added by administrator');
  if length(v_description) > 240 then
    raise exception 'Description must be 240 characters or fewer';
  end if;
  insert into public.wallet_transactions (
    user_id, transaction_type, direction, amount, currency, status,
    reference_type, idempotency_key, description, created_by, metadata
  ) values (
    p_user_id, 'admin_credit', 'credit', p_amount, p_currency, 'posted',
    'admin_manual_credit', 'admin-credit:' || gen_random_uuid()::text,
    v_description, (select auth.uid()), jsonb_build_object('source', 'admin_manual_credit')
  )
  returning id into v_transaction_id;
  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'admin_wallet_balance_added', 'wallet_transaction', v_transaction_id,
    jsonb_build_object('customer_id', p_user_id, 'amount', p_amount, 'currency', p_currency, 'description', v_description));
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
  if p_currency not in ('AED','OMR','SAR','KWD','BHD','QAR','INR') then raise exception 'Unsupported currency'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid payout period';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Customer not found'; end if;

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
    coalesce(p_description, 'Profit credited to customer wallet'), (select auth.uid())
  )
  returning id into v_transaction_id;

  update public.profit_payouts
  set status = 'credited', wallet_transaction_id = v_transaction_id, credited_at = now()
  where id = v_payout_id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'profit_credited', 'profit_payout', v_payout_id,
    jsonb_build_object('amount', p_amount, 'currency', p_currency, 'customer_id', p_user_id, 'ledger_id', v_transaction_id));
  return v_transaction_id;
end;
$$;

revoke all on function public.admin_add_wallet_balance(uuid,numeric,text,text) from public, anon;
revoke all on function public.admin_credit_profit_payout(uuid,numeric,text,date,date,text) from public, anon;
grant execute on function public.admin_add_wallet_balance(uuid,numeric,text,text) to authenticated;
grant execute on function public.admin_credit_profit_payout(uuid,numeric,text,date,date,text) to authenticated;
