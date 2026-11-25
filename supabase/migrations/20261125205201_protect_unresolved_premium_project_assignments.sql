create or replace function public.enforce_sequential_member_project_order()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_target public.properties%rowtype;
  v_level_unlocked boolean;
  v_next_position integer;
begin
  if new.plan_code <> 'project_order' then
    return new;
  end if;

  if new.user_id is null or new.property_id is null then
    raise exception 'A project order must include a member and property';
  end if;

  select *
    into v_target
    from public.properties
   where id = new.property_id
     and status = 'published';

  if not found then
    raise exception 'This project is not currently available';
  end if;

  if v_target.project_level = 'Junior Trial' then
    select coalesce(bool_or(is_unlocked), false)
      into v_level_unlocked
      from public.customer_project_level_access
     where user_id = new.user_id
       and level_name = 'Junior Trial';

    if not coalesce(v_level_unlocked, false) then
      raise exception 'Junior Trial access has not been approved by the administrator';
    end if;
  end if;

  if v_target.project_level <> 'Junior Trial' then
    select count(distinct existing.property_id)::integer
      into v_next_position
      from public.investment_requests existing
      join public.properties ordered_property
        on ordered_property.id = existing.property_id
     where existing.user_id = new.user_id
       and existing.plan_code = 'project_order'
       and existing.status in ('pending', 'approved', 'funded')
       and ordered_property.project_level = v_target.project_level
       and ordered_property.set_number = v_target.set_number;

    v_next_position := coalesce(v_next_position, 0) + 1;

    if exists (
      select 1
        from public.premium_project_assignments assignment
       where assignment.user_id = new.user_id
         and assignment.level_name = v_target.project_level
         and assignment.badge_number = v_target.set_number
         and assignment.position = v_next_position
         and assignment.status in ('active', 'presented')
    ) then
      raise exception 'A Premium Project assignment must be resolved by Customer Support before this property can be ordered';
    end if;
  end if;

  if exists (
    select 1
      from public.properties prior
     where prior.status = 'published'
       and prior.project_level = v_target.project_level
       and prior.set_number = v_target.set_number
       and (
         prior.sort_order < v_target.sort_order
         or (prior.sort_order = v_target.sort_order and prior.id < v_target.id)
       )
       and not exists (
         select 1
           from public.investment_requests existing
          where existing.user_id = new.user_id
            and existing.property_id = prior.id
            and existing.plan_code = 'project_order'
            and existing.status in ('pending','approved','funded')
       )
  ) then
    raise exception 'Please complete the previous property in this progression first';
  end if;

  return new;
end;
$function$;
