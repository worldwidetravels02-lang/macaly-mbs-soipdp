-- Repair missing Trial Bonus and project-order database objects on an existing
-- partially migrated Supabase project. This migration is additive and preserves
-- existing wallet balances and historical records.
--
-- Apply only after reviewing the current database state. Do not run earlier
-- historical migrations again as a substitute for this targeted repair.

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
  v_pending_orders numeric(20,2) := 0;
  v_transaction_id uuid;
  v_commission_transaction_id uuid;
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
  perform 1 from auth.users where id = v_request.user_id for update;
  -- Serialize funding with withdrawals, wallet holds and new project-order reservations.
  perform pg_advisory_xact_lock(hashtextextended(v_request.user_id::text || ':OMR', 0));

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
      select coalesce(sum(ir.amount), 0) into v_pending_orders
      from public.investment_requests ir
      join public.properties p on p.id = ir.property_id
      where ir.user_id = v_request.user_id and ir.id <> v_request.id
        and ir.plan_code = 'project_order' and ir.currency = 'OMR'
        and ir.status in ('pending','approved') and p.project_level = 'Junior Trial';
      if coalesce(v_balance, 0) - v_pending_orders < v_request.amount then
        raise exception 'Customer does not have enough available Trial Bonus after other pending Junior Trial orders';
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
      where user_id = v_request.user_id and currency = 'OMR' and status = 'pending';
      select coalesce(sum(ir.amount), 0) into v_pending_orders
      from public.investment_requests ir
      join public.properties p on p.id = ir.property_id
      where ir.user_id = v_request.user_id and ir.id <> v_request.id
        and ir.plan_code = 'project_order' and ir.currency = 'OMR'
        and ir.status in ('pending','approved') and p.project_level <> 'Junior Trial';
      if coalesce(v_balance, 0) - v_holds - v_reserved - v_pending_orders < v_request.amount then
        raise exception 'Customer does not have enough available OMR wallet balance after holds, withdrawals and other pending project orders';
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
      ) returning id into v_commission_transaction_id;

      update public.commission_records
      set wallet_transaction_id = v_commission_transaction_id
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

create or replace function public.notify_admin_project_badge_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text;
  v_set_number smallint;
  v_count integer;
  v_next_label text;
  v_customer_name text;
  v_message text;
  v_title text;
begin
  if new.plan_code <> 'project_order'
     or new.status <> 'funded'
     or old.status = 'funded'
     or new.user_id is null
     or new.property_id is null then
    return new;
  end if;

  select p.project_level, p.set_number
    into v_level, v_set_number
    from public.properties p
    where p.id = new.property_id;

  if v_level is null or v_set_number is null then
    return new;
  end if;

  select count(distinct ir.property_id)::integer
    into v_count
    from public.investment_requests ir
    join public.properties p on p.id = ir.property_id
    where ir.user_id = new.user_id
      and ir.plan_code = 'project_order'
      and ir.status = 'funded'
      and p.project_level = v_level
      and p.set_number = v_set_number;

  if v_count <> 20 then
    return new;
  end if;

  v_next_label := case
    when v_set_number < 3 then v_level || ' · Badge ' || (v_set_number + 1)::text
    when v_level = 'Junior Trial' then 'Senior · Badge 1'
    when v_level = 'Senior' then 'Master · Badge 1'
    when v_level = 'Master' then 'Expert · Badge 1'
    else 'All project badges completed'
  end;

  select coalesce(nullif(trim(pr.full_name), ''), au.email, 'Customer')
    into v_customer_name
    from auth.users au
    left join public.profiles pr on pr.id = au.id
    where au.id = new.user_id;

  if v_level = 'Junior Trial' then
    v_title := 'Customer completed Junior Trial progress';
    v_message := v_customer_name || ' has successfully funded all 20 properties in Junior Trial. ' ||
      'Please review the customer and unlock ' || v_next_label ||
      ' from the Users → Badge Management section.';
  else
    v_title := 'Customer completed a project badge';
    v_message := v_customer_name || ' has successfully funded all 20 properties in ' ||
      v_level || ' · Badge ' || v_set_number::text ||
      '. Please review the customer and unlock ' || v_next_label ||
      ' from the Users → Badge Management section.';
  end if;

  insert into public.notifications (user_id, title, body)
  select am.user_id, v_title, v_message
  from public.admin_members am
  where not exists (
    select 1 from public.notifications n
    where n.user_id = am.user_id
      and n.title = v_title
      and n.body = v_message
  );

  return new;
end;
$$;

revoke all on function public.notify_admin_project_badge_completion() from public, anon, authenticated;
drop trigger if exists notify_admin_project_level_completion on public.investment_requests;
drop trigger if exists unlock_next_project_level_after_twenty_orders on public.investment_requests;
drop trigger if exists notify_admin_project_badge_completion on public.investment_requests;
create trigger notify_admin_project_badge_completion
after update of status on public.investment_requests
for each row execute function public.notify_admin_project_badge_completion();

create or replace function public.member_submit_project_order(p_property_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_property public.properties%rowtype;
  v_level_unlocked boolean;
  v_set_unlocked boolean;
  v_commission_percent numeric(8,4);
  v_amount numeric(20,2);
  v_available numeric(20,2);
  v_holds numeric(20,2) := 0;
  v_reserved numeric(20,2) := 0;
  v_pending_orders numeric(20,2) := 0;
  v_set_order_count integer := 0;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  perform 1 from auth.users where id = v_user_id for update;
  -- Share the same per-customer OMR lock as withdrawals and admin wallet holds.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':OMR', 0));

  select * into v_property
  from public.properties
  where id = p_property_id and status = 'published'
  for share;
  if not found then raise exception 'This project is not currently available'; end if;
  if v_property.project_level is null or v_property.set_number not between 1 and 3 then
    raise exception 'This project is not assigned to a valid badge';
  end if;
  if v_property.price_amount is null or v_property.price_amount <= 0 then
    raise exception 'The administrator has not set a confirmed OMR price for this project';
  end if;
  if coalesce(cardinality(v_property.order_percentages), 0) < 1 then
    raise exception 'The administrator has not configured a commission percentage for this project';
  end if;

  select coalesce(v_property.order_percentages[1], 0)::numeric(8,4)
    into v_commission_percent;
  if v_commission_percent < 0 or v_commission_percent > 100 then
    raise exception 'The configured project commission percentage is invalid';
  end if;
  v_amount := round(v_property.price_amount, 2);

  if v_property.project_level <> 'Junior Trial' then
    select coalesce(bool_or(is_unlocked), false) into v_level_unlocked
    from public.customer_project_level_access
    where user_id = v_user_id and level_name = v_property.project_level;
    if not coalesce(v_level_unlocked, false) then
      raise exception 'This project level has not been unlocked by the administrator';
    end if;
  else
    select coalesce(bool_or(is_unlocked), true) into v_level_unlocked
    from public.customer_project_level_access
    where user_id = v_user_id and level_name = v_property.project_level;
    if not coalesce(v_level_unlocked, true) then
      raise exception 'Junior Trial is locked for this customer';
    end if;
  end if;

  select coalesce(bool_or(is_unlocked), v_property.set_number = 1) into v_set_unlocked
  from public.customer_project_set_access
  where user_id = v_user_id
    and level_name = v_property.project_level
    and set_number = v_property.set_number;
  if not coalesce(v_set_unlocked, v_property.set_number = 1) then
    raise exception 'This badge has not been unlocked by the administrator';
  end if;

  if exists (
    select 1 from public.investment_requests
    where user_id = v_user_id and property_id = p_property_id
      and plan_code = 'project_order'
      and status not in ('rejected','cancelled')
  ) then
    raise exception 'You already submitted an order for this property';
  end if;

  -- Each customer can submit at most 20 active/funded properties in one badge.
  select count(distinct ir.property_id)::integer
    into v_set_order_count
  from public.investment_requests ir
  join public.properties p on p.id = ir.property_id
  where ir.user_id = v_user_id
    and ir.plan_code = 'project_order'
    and ir.status in ('pending','approved','funded')
    and p.project_level = v_property.project_level
    and p.set_number = v_property.set_number;

  if v_set_order_count >= 20 then
    raise exception 'This badge already has 20 submitted properties';
  end if;

  if v_property.project_level = 'Junior Trial' then
    select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
      into v_available
    from public.trial_bonus_transactions
    where user_id = v_user_id and currency = 'OMR';
    select coalesce(sum(ir.amount), 0) into v_pending_orders
    from public.investment_requests ir
    join public.properties p on p.id = ir.property_id
    where ir.user_id = v_user_id and ir.plan_code = 'project_order'
      and ir.currency = 'OMR' and ir.status in ('pending','approved')
      and p.project_level = 'Junior Trial';
    if coalesce(v_available, 0) - v_pending_orders < v_amount then
      raise exception 'Insufficient Trial Bonus balance for this OMR project order';
    end if;
  else
    select coalesce(balance, 0) into v_available
    from public.wallet_balances
    where user_id = v_user_id and currency = 'OMR';
    select coalesce(sum(greatest(0, amount - released_amount)), 0) into v_holds
    from public.wallet_holds
    where user_id = v_user_id and currency = 'OMR' and status = 'active';
    select coalesce(sum(amount), 0) into v_reserved
    from public.withdrawal_requests
    where user_id = v_user_id and currency = 'OMR' and status = 'pending';
    select coalesce(sum(ir.amount), 0) into v_pending_orders
    from public.investment_requests ir
    join public.properties p on p.id = ir.property_id
    where ir.user_id = v_user_id and ir.plan_code = 'project_order'
      and ir.currency = 'OMR' and ir.status in ('pending','approved')
      and p.project_level <> 'Junior Trial';
    if coalesce(v_available, 0) - v_holds - v_reserved - v_pending_orders < v_amount then
      raise exception 'Insufficient available OMR wallet balance after holds, withdrawals and other pending project orders';
    end if;
  end if;

  insert into public.investment_requests(
    user_id, property_id, property_name, plan_code, amount, currency,
    commission_percent, expected_commission, note, status
  ) values (
    v_user_id, v_property.id, v_property.name, 'project_order', v_amount, 'OMR',
    v_commission_percent, round(v_amount * v_commission_percent / 100, 2),
    'Project order · Level: ' || v_property.project_level ||
      ' · Badge: ' || v_property.set_number::text ||
      ' · Commission: ' || v_commission_percent::text || '%',
    'pending'
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.member_submit_project_order(uuid) from public, anon;
grant execute on function public.member_submit_project_order(uuid) to authenticated;

-- Keep direct customer inserts for project_order disabled. Recreate only the
-- intended non-project insert policy; other policies are left untouched.
drop policy if exists "Members create investment requests" on public.investment_requests;
drop policy if exists "Members create non-project investment requests" on public.investment_requests;
create policy "Members create non-project investment requests"
  on public.investment_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and plan_code <> 'project_order'
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and funded_at is null
  );

update public.properties
set set_number = 1
where project_level = 'Junior Trial'
  and set_number is distinct from 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.properties'::regclass
      and conname = 'properties_junior_trial_single_progression_check'
  ) then
    alter table public.properties
      add constraint properties_junior_trial_single_progression_check
      check (project_level <> 'Junior Trial' or set_number = 1);
  end if;
end $$;

create or replace function public.member_submit_project_order(p_property_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_property public.properties%rowtype;
  v_level_unlocked boolean;
  v_set_unlocked boolean;
  v_commission_percent numeric(8,4);
  v_amount numeric(20,2);
  v_available numeric(20,2);
  v_holds numeric(20,2) := 0;
  v_reserved numeric(20,2) := 0;
  v_pending_orders numeric(20,2) := 0;
  v_set_order_count integer := 0;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  perform 1 from auth.users where id = v_user_id for update;
  -- Share the same per-customer OMR lock as withdrawals and admin wallet holds.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':OMR', 0));

  select * into v_property
  from public.properties
  where id = p_property_id and status = 'published'
  for share;
  if not found then raise exception 'This project is not currently available'; end if;
  if v_property.project_level is null or v_property.set_number not between 1 and 3 then
    raise exception 'This project is not assigned to a valid badge';
  end if;
  if v_property.price_amount is null or v_property.price_amount <= 0 then
    raise exception 'The administrator has not set a confirmed OMR price for this project';
  end if;
  if coalesce(cardinality(v_property.order_percentages), 0) < 1 then
    raise exception 'The administrator has not configured a commission percentage for this project';
  end if;

  select coalesce(v_property.order_percentages[1], 0)::numeric(8,4)
    into v_commission_percent;
  if v_commission_percent < 0 or v_commission_percent > 100 then
    raise exception 'The configured project commission percentage is invalid';
  end if;
  v_amount := round(v_property.price_amount, 2);

  if v_property.project_level <> 'Junior Trial' then
    select coalesce(bool_or(is_unlocked), false) into v_level_unlocked
    from public.customer_project_level_access
    where user_id = v_user_id and level_name = v_property.project_level;
    if not coalesce(v_level_unlocked, false) then
      raise exception 'This project level has not been unlocked by the administrator';
    end if;
  else
    select coalesce(bool_or(is_unlocked), true) into v_level_unlocked
    from public.customer_project_level_access
    where user_id = v_user_id and level_name = v_property.project_level;
    if not coalesce(v_level_unlocked, true) then
      raise exception 'Junior Trial is locked for this customer';
    end if;
  end if;

  -- Junior Trial is one progression and never uses per-badge unlock records.
  if v_property.project_level <> 'Junior Trial' then
    select coalesce(bool_or(is_unlocked), v_property.set_number = 1) into v_set_unlocked
    from public.customer_project_set_access
    where user_id = v_user_id
      and level_name = v_property.project_level
      and set_number = v_property.set_number;
    if not coalesce(v_set_unlocked, v_property.set_number = 1) then
      raise exception 'This badge has not been unlocked by the administrator';
    end if;
  end if;

  if exists (
    select 1 from public.investment_requests
    where user_id = v_user_id and property_id = p_property_id
      and plan_code = 'project_order'
      and status not in ('rejected','cancelled')
  ) then
    raise exception 'You already submitted an order for this property';
  end if;

  -- Each customer can submit at most 20 active/funded properties in one badge.
  select count(distinct ir.property_id)::integer
    into v_set_order_count
  from public.investment_requests ir
  join public.properties p on p.id = ir.property_id
  where ir.user_id = v_user_id
    and ir.plan_code = 'project_order'
    and ir.status in ('pending','approved','funded')
    and p.project_level = v_property.project_level
    and (v_property.project_level = 'Junior Trial' or p.set_number = v_property.set_number);

  if v_set_order_count >= 20 then
    if v_property.project_level = 'Junior Trial' then
      raise exception 'Junior Trial already has 20 submitted properties';
    else
      raise exception 'This badge already has 20 submitted properties';
    end if;
  end if;

  if v_property.project_level = 'Junior Trial' then
    select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
      into v_available
    from public.trial_bonus_transactions
    where user_id = v_user_id and currency = 'OMR';
    select coalesce(sum(ir.amount), 0) into v_pending_orders
    from public.investment_requests ir
    join public.properties p on p.id = ir.property_id
    where ir.user_id = v_user_id and ir.plan_code = 'project_order'
      and ir.currency = 'OMR' and ir.status in ('pending','approved')
      and p.project_level = 'Junior Trial';
    if coalesce(v_available, 0) - v_pending_orders < v_amount then
      raise exception 'Insufficient Trial Bonus balance for this OMR project order';
    end if;
  else
    select coalesce(balance, 0) into v_available
    from public.wallet_balances
    where user_id = v_user_id and currency = 'OMR';
    select coalesce(sum(greatest(0, amount - released_amount)), 0) into v_holds
    from public.wallet_holds
    where user_id = v_user_id and currency = 'OMR' and status = 'active';
    select coalesce(sum(amount), 0) into v_reserved
    from public.withdrawal_requests
    where user_id = v_user_id and currency = 'OMR' and status = 'pending';
    select coalesce(sum(ir.amount), 0) into v_pending_orders
    from public.investment_requests ir
    join public.properties p on p.id = ir.property_id
    where ir.user_id = v_user_id and ir.plan_code = 'project_order'
      and ir.currency = 'OMR' and ir.status in ('pending','approved')
      and p.project_level <> 'Junior Trial';
    if coalesce(v_available, 0) - v_holds - v_reserved - v_pending_orders < v_amount then
      raise exception 'Insufficient available OMR wallet balance after holds, withdrawals and other pending project orders';
    end if;
  end if;

  insert into public.investment_requests(
    user_id, property_id, property_name, plan_code, amount, currency,
    commission_percent, expected_commission, note, status
  ) values (
    v_user_id, v_property.id, v_property.name, 'project_order', v_amount, 'OMR',
    v_commission_percent, round(v_amount * v_commission_percent / 100, 2),
    case when v_property.project_level = 'Junior Trial'
      then 'Project order · Level: Junior Trial · Commission: ' || v_commission_percent::text || '%'
      else 'Project order · Level: ' || v_property.project_level ||
        ' · Badge: ' || v_property.set_number::text ||
        ' · Commission: ' || v_commission_percent::text || '%'
    end,
    'pending'
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.member_submit_project_order(uuid) from public, anon;
grant execute on function public.member_submit_project_order(uuid) to authenticated;
