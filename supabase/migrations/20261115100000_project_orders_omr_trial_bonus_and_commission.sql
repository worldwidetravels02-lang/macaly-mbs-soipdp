-- Project order accounting: OMR prices, a separate Junior Trial Bonus ledger,
-- and automatic wallet commission credit when an administrator funds a project order.
-- Additive only: no existing balances or historical records are rewritten.

comment on column public.properties.price_amount is
  'Administrator-set base project price in OMR for catalogue order calculations.';
comment on column public.properties.order_percentages is
  'Administrator-configured commission percentages available for each project order.';

create table if not exists public.trial_bonus_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  direction text not null check (direction in ('credit','debit')),
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'OMR' check (currency = 'OMR'),
  reference_type text,
  reference_id uuid,
  idempotency_key text not null unique,
  description text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists trial_bonus_transactions_user_created_idx
  on public.trial_bonus_transactions(user_id, created_at desc);

alter table public.trial_bonus_transactions enable row level security;
revoke all on public.trial_bonus_transactions from anon, authenticated;
grant select on public.trial_bonus_transactions to authenticated;

drop policy if exists "Members read own trial bonus transactions" on public.trial_bonus_transactions;
create policy "Members read own trial bonus transactions"
  on public.trial_bonus_transactions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create or replace function public.admin_add_trial_bonus(
  p_user_id uuid,
  p_amount numeric,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_description text;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Select a valid customer';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Trial bonus must be greater than zero and no more than 100,000,000 OMR';
  end if;
  v_description := coalesce(nullif(btrim(p_description), ''), 'Trial bonus added by administrator');
  if length(v_description) > 240 then
    raise exception 'Description must be 240 characters or fewer';
  end if;

  insert into public.trial_bonus_transactions(
    user_id, direction, amount, currency, reference_type,
    idempotency_key, description, created_by
  ) values (
    p_user_id, 'credit', p_amount, 'OMR', 'admin_trial_bonus',
    'trial-bonus-admin:' || gen_random_uuid()::text, v_description, (select auth.uid())
  ) returning id into v_id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'admin_trial_bonus_added', 'trial_bonus_transaction', v_id,
    jsonb_build_object('customer_id', p_user_id, 'amount', p_amount, 'currency', 'OMR', 'description', v_description));
  return v_id;
end;
$$;

revoke all on function public.admin_add_trial_bonus(uuid,numeric,text) from public, anon;
grant execute on function public.admin_add_trial_bonus(uuid,numeric,text) to authenticated;

-- Preserve the customer-selected project commission percentage. Other plan approvals
-- continue to use the administrator-configured membership-plan percentages.
create or replace function public.admin_review_investment_request(
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
    if v_request.plan_code = 'project_order' then
      if v_request.currency <> 'OMR' then
        raise exception 'Project orders must use OMR';
      end if;
      v_commission_percent := coalesce(v_request.commission_percent, 0);
      if v_commission_percent < 0 or v_commission_percent > 100 then
        raise exception 'Project commission percentage is invalid';
      end if;
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
  v_holds numeric(20,2) := 0;
  v_reserved numeric(20,2) := 0;
  v_transaction_id uuid;
  v_bonus_transaction_id uuid;
  v_investment_id uuid;
  v_commission_amount numeric(20,2);
  v_commission_id uuid;
  v_project_level text;
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

  if v_request.plan_code = 'project_order' then
    if v_request.currency <> 'OMR' then
      raise exception 'Project orders must use OMR';
    end if;
    select project_level into v_project_level
    from public.properties where id = v_request.property_id;
    if v_project_level is null then
      raise exception 'The project level could not be verified';
    end if;

    if v_project_level = 'Junior Trial' then
      select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
        into v_balance
      from public.trial_bonus_transactions
      where user_id = v_request.user_id and currency = 'OMR';
      if coalesce(v_balance, 0) < v_request.amount then
        raise exception 'Customer does not have enough Trial Bonus in OMR';
      end if;
      insert into public.trial_bonus_transactions(
        user_id, direction, amount, currency, reference_type, reference_id,
        idempotency_key, description, created_by
      ) values (
        v_request.user_id, 'debit', v_request.amount, 'OMR',
        'project_order', v_request.id, 'trial-bonus-order:' || v_request.id::text,
        'Junior Trial property order: ' || v_request.property_name, (select auth.uid())
      ) returning id into v_bonus_transaction_id;
    else
      select coalesce(balance, 0) into v_balance
      from public.wallet_balances
      where user_id = v_request.user_id and currency = 'OMR';
      select coalesce(sum(greatest(0, amount - released_amount)), 0) into v_holds
      from public.wallet_holds
      where user_id = v_request.user_id and currency = 'OMR' and status = 'active';
      select coalesce(sum(amount), 0) into v_reserved
      from public.withdrawal_requests
      where user_id = v_request.user_id and currency = 'OMR' and status in ('pending','approved');
      if coalesce(v_balance, 0) - v_holds - v_reserved < v_request.amount then
        raise exception 'Customer does not have enough available OMR wallet balance after holds and pending withdrawals';
      end if;
      insert into public.wallet_transactions(
        user_id, transaction_type, direction, amount, currency, status,
        reference_type, reference_id, idempotency_key, description, created_by, metadata
      ) values (
        v_request.user_id, 'investment_funding', 'debit', v_request.amount,
        'OMR', 'posted', 'investment_request', v_request.id,
        'investment-funding:' || v_request.id::text,
        'Project order funded: ' || v_request.property_name, (select auth.uid()),
        jsonb_build_object('property_id', v_request.property_id, 'plan_code', v_request.plan_code, 'project_level', v_project_level)
      ) returning id into v_transaction_id;
    end if;
  else
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
    ) returning id into v_transaction_id;
  end if;

  insert into public.investments(
    user_id, property_id, amount, currency, status, reference,
    admin_note, approved_by, approved_at
  ) values (
    v_request.user_id, v_request.property_id, v_request.amount, v_request.currency,
    'funded', 'request:' || v_request.id::text, v_request.admin_note,
    (select auth.uid()), now()
  ) returning id into v_investment_id;

  v_commission_amount := round(v_request.amount * coalesce(v_request.commission_percent, 0) / 100, 2);
  if v_commission_amount > 0 then
    if v_request.plan_code = 'project_order' then
      insert into public.commission_records(
        user_id, plan_id, commission_type, reference, base_amount,
        commission_percent, amount, currency, status, description,
        idempotency_key, created_by, reviewed_by, reviewed_at, credited_at
      ) values (
        v_request.user_id, v_request.plan_id, 'property',
        'project-order:' || v_request.id::text, v_request.amount,
        v_request.commission_percent, v_commission_amount, 'OMR',
        'credited', 'Project order commission credited automatically',
        'project-order-commission:' || v_request.id::text, (select auth.uid()),
        (select auth.uid()), now(), now()
      ) returning id into v_commission_id;

      insert into public.wallet_transactions(
        user_id, transaction_type, direction, amount, currency, status,
        reference_type, reference_id, idempotency_key, description, created_by, metadata
      ) values (
        v_request.user_id, 'commission', 'credit', v_commission_amount, 'OMR', 'posted',
        'commission_record', v_commission_id,
        'project-order-commission-credit:' || v_request.id::text,
        'Project order commission: ' || v_request.property_name, (select auth.uid()),
        jsonb_build_object('investment_request_id', v_request.id, 'commission_percent', v_request.commission_percent)
      ) returning id into v_transaction_id;

      update public.commission_records
      set wallet_transaction_id = v_transaction_id
      where id = v_commission_id;
    else
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
  end if;

  update public.investment_requests
  set status = 'funded', funded_at = now(), wallet_transaction_id =
    case when v_request.plan_code = 'project_order' and v_project_level = 'Junior Trial'
      then null else v_transaction_id end
  where id = v_request.id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'investment_funded', 'investment_request',
    v_request.id, jsonb_build_object('investment_id', v_investment_id,
      'wallet_transaction_id', v_transaction_id, 'trial_bonus_transaction_id', v_bonus_transaction_id,
      'commission_record_id', v_commission_id, 'amount', v_request.amount,
      'currency', v_request.currency, 'project_level', v_project_level));

  return coalesce(v_transaction_id, v_bonus_transaction_id);
end;
$$;

revoke all on function public.admin_review_investment_request(uuid,text,text) from public, anon;
revoke all on function public.admin_fund_investment_request(uuid) from public, anon;
grant execute on function public.admin_review_investment_request(uuid,text,text) to authenticated;
grant execute on function public.admin_fund_investment_request(uuid) to authenticated;
