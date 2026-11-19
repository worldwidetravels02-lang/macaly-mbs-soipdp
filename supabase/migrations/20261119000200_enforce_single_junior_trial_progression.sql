-- Enforce one 20-property Junior Trial progression across all existing and future records.
-- Senior, Master and Expert retain their three independently unlocked badge sets.

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
