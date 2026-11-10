-- Automatically unlock the next project level after 20 distinct property orders.
-- An order counts once it has been successfully submitted. Rejected and cancelled
-- requests do not count toward progress.

create or replace function public.unlock_next_project_level_after_twenty_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text;
  v_next_level text;
  v_order_count integer;
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

  if v_order_count >= 20 then
    insert into public.customer_project_level_access
      (user_id, level_name, is_unlocked, updated_at)
    values
      (new.user_id, v_next_level, true, now())
    on conflict (user_id, level_name)
    do update set is_unlocked = true, updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.unlock_next_project_level_after_twenty_orders() from public, anon, authenticated;
drop trigger if exists unlock_next_project_level_after_twenty_orders on public.investment_requests;
create trigger unlock_next_project_level_after_twenty_orders
after insert on public.investment_requests
for each row execute function public.unlock_next_project_level_after_twenty_orders();

-- Backfill progression for customers who already have 20 qualifying orders.
insert into public.customer_project_level_access
  (user_id, level_name, is_unlocked, updated_at)
select ir.user_id,
       case p.project_level
         when 'Junior Trial' then 'Senior'
         when 'Senior' then 'Master'
         when 'Master' then 'Expert'
       end,
       true,
       now()
from public.investment_requests ir
join public.properties p on p.id = ir.property_id
where ir.plan_code = 'project_order'
  and lower(coalesce(ir.status, 'pending')) not in ('rejected', 'cancelled')
  and p.project_level in ('Junior Trial', 'Senior', 'Master')
group by ir.user_id, p.project_level
having count(distinct ir.property_id) >= 20
on conflict (user_id, level_name)
do update set is_unlocked = true, updated_at = now();
