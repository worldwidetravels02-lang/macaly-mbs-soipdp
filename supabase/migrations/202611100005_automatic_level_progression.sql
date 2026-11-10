-- Notify administrators when a customer completes 20 distinct project orders.
-- The next level remains locked until an administrator uses the existing
-- "Unlock for customer" control in the admin panel.

create or replace function public.notify_admin_project_level_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text;
  v_next_level text;
  v_order_count integer;
  v_customer_name text;
begin
  if new.plan_code <> 'project_order' or new.user_id is null or new.property_id is null then
    return new;
  end if;

  select p.project_level
    into v_level
    from public.properties p
    where p.id = new.property_id;

  v_next_level := case v_level
    when 'Junior Trial' then 'Senior'
    when 'Senior' then 'Master'
    when 'Master' then 'Expert'
    else null
  end;

  if v_next_level is null then
    return new;
  end if;

  select count(distinct ir.property_id)::integer
    into v_order_count
    from public.investment_requests ir
    join public.properties p on p.id = ir.property_id
    where ir.user_id = new.user_id
      and ir.plan_code = 'project_order'
      and p.project_level = v_level
      and lower(coalesce(ir.status, 'pending')) not in ('rejected', 'cancelled');

  -- Send one notification at the completion threshold, not on every later order.
  if v_order_count = 20 then
    select coalesce(nullif(trim(pr.full_name), ''), au.email, 'Customer')
      into v_customer_name
      from auth.users au
      left join public.profiles pr on pr.id = au.id
      where au.id = new.user_id;

    insert into public.notifications (user_id, title, body)
    select am.user_id,
           'Customer ready for next project level',
           v_customer_name || ' has completed 20 different ' || v_level ||
           ' project orders and is ready for ' || v_next_level ||
           '. Please review the customer and approve the next level in Customers → Unlock levels.'
    from public.admin_members am
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = am.user_id
        and n.title = 'Customer ready for next project level'
        and n.body like v_customer_name || ' has completed 20 different ' || v_level || ' project orders%'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_admin_project_level_completion() from public, anon, authenticated;
drop trigger if exists unlock_next_project_level_after_twenty_orders on public.investment_requests;
drop trigger if exists notify_admin_project_level_completion on public.investment_requests;
create trigger notify_admin_project_level_completion
after insert on public.investment_requests
for each row execute function public.notify_admin_project_level_completion();

-- Notify administrators about customers who had already reached the threshold
-- before this migration was applied. This does not unlock any customer level.
with eligible as (
  select ir.user_id,
         p.project_level,
         case p.project_level
           when 'Junior Trial' then 'Senior'
           when 'Senior' then 'Master'
           when 'Master' then 'Expert'
         end as next_level,
         count(distinct ir.property_id) as order_count
  from public.investment_requests ir
  join public.properties p on p.id = ir.property_id
  where ir.plan_code = 'project_order'
    and lower(coalesce(ir.status, 'pending')) not in ('rejected', 'cancelled')
    and p.project_level in ('Junior Trial', 'Senior', 'Master')
  group by ir.user_id, p.project_level
  having count(distinct ir.property_id) >= 20
)
insert into public.notifications (user_id, title, body)
select am.user_id,
       'Customer ready for next project level',
       coalesce(nullif(trim(pr.full_name), ''), au.email, 'Customer') ||
       ' has completed 20 different ' || e.project_level ||
       ' project orders and is ready for ' || e.next_level ||
       '. Please review the customer and approve the next level in Customers → Unlock levels.'
from eligible e
join auth.users au on au.id = e.user_id
left join public.profiles pr on pr.id = e.user_id
cross join public.admin_members am
where not exists (
  select 1
  from public.notifications n
  where n.user_id = am.user_id
    and n.title = 'Customer ready for next project level'
    and n.body like coalesce(nullif(trim(pr.full_name), ''), au.email, 'Customer') ||
      ' has completed 20 different ' || e.project_level || ' project orders%'
);
