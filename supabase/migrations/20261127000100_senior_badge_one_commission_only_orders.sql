-- Allow configured commission percentages from 0 through 100.
-- Senior Badge 1 project orders do not debit or reserve the customer's wallet.
-- Junior Trial and every other badge retain their existing accounting behavior.

alter table public.properties
  drop constraint if exists properties_order_percentages_allowed_check;
alter table public.properties
  add constraint properties_order_percentages_allowed_check
  check (
    cardinality(order_percentages) between 1 and 20
    and 0 <= all(order_percentages)
    and 100 >= all(order_percentages)
  );

comment on column public.properties.order_percentages is
  'Administrator-configured commission percentages from 0 to 100, inclusive.';

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

  -- Junior Trial is always accessible after sign-in. Admin-controlled
  -- level unlocks apply only to Senior, Master and Expert.
  if v_property.project_level <> 'Junior Trial' then
    select coalesce(bool_or(is_unlocked), false) into v_level_unlocked
    from public.customer_project_level_access
    where user_id = v_user_id and level_name = v_property.project_level;
    if not coalesce(v_level_unlocked, false) then
      raise exception 'This project level has not been unlocked by the administrator';
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
  elsif not (v_property.project_level = 'Senior' and v_property.set_number = 1) then
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
      and p.project_level <> 'Junior Trial'
      and not (p.project_level = 'Senior' and p.set_number = 1);
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
  v_project_set_number smallint;
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
    select project_level, set_number into v_project_level, v_project_set_number
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
    elsif not (v_project_level = 'Senior' and v_project_set_number = 1) then
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
        and ir.status in ('pending','approved') and p.project_level <> 'Junior Trial'
        and not (p.project_level = 'Senior' and p.set_number = 1);
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
    case when v_request.plan_code = 'project_order'
      and (v_project_level = 'Junior Trial' or (v_project_level = 'Senior' and v_project_set_number = 1))
      then null else v_transaction_id end
  where id = v_request.id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'investment_funded', 'investment_request',
    v_request.id, jsonb_build_object('investment_id', v_investment_id,
      'wallet_transaction_id', v_transaction_id, 'trial_bonus_transaction_id', v_bonus_transaction_id,
      'commission_record_id', v_commission_id, 'amount', v_request.amount,
      'currency', v_request.currency, 'project_level', v_project_level));

  return coalesce(v_transaction_id, v_bonus_transaction_id, v_commission_transaction_id, v_investment_id);
end;
$$;

revoke all on function public.member_submit_project_order(uuid) from public, anon;
revoke all on function public.admin_fund_investment_request(uuid) from public, anon;
grant execute on function public.member_submit_project_order(uuid) to authenticated;
grant execute on function public.admin_fund_investment_request(uuid) to authenticated;
