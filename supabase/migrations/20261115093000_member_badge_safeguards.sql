-- Badge progression safeguards and support-request policy correction.
-- Apply after 20261115090000_member_badges.sql.

-- A property may only be assigned once across all three badges in a level.
create or replace function public.check_badge_property_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_level text;
  existing_count integer;
begin
  select level into target_level
  from public.project_badges
  where id = new.badge_id;

  select count(*) into existing_count
  from public.project_badge_properties bp
  join public.project_badges b on b.id = bp.badge_id
  where b.level = target_level
    and bp.property_id = new.property_id
    and (tg_op = 'INSERT' or bp.id <> new.id);

  if existing_count > 0 then
    raise exception 'This property is already assigned to another badge in this level';
  end if;

  select count(*) into existing_count
  from public.project_badge_properties bp
  where bp.badge_id = new.badge_id
    and (tg_op = 'INSERT' or bp.id <> new.id);

  if existing_count >= 20 then
    raise exception 'A badge can contain no more than 20 properties';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_badge_property_assignment on public.project_badge_properties;
create trigger enforce_badge_property_assignment
before insert or update of badge_id, property_id
on public.project_badge_properties
for each row execute function public.check_badge_property_assignment();

-- A customer may request the next badge once the previous badge is completed.
-- The global badge lock is an admin catalogue control; it must not block the
-- customer's support-request action.
drop policy if exists "Members request next badge unlock" on public.member_badge_progress;
create policy "Members request next badge unlock"
on public.member_badge_progress for update to authenticated
using (
  user_id = (select auth.uid())
  and status = 'locked'
  and exists (
    select 1
    from public.project_badges b
    join public.member_badge_progress previous
      on previous.user_id = (select auth.uid())
    join public.project_badges prior
      on prior.id = previous.badge_id
     and prior.level = b.level
     and prior.badge_number = b.badge_number - 1
    where b.id = member_badge_progress.badge_id
      and b.badge_number > 1
      and previous.status = 'completed'
  )
)
with check (
  user_id = (select auth.uid())
  and status = 'support_requested'
);

-- Ensure each badge completion update only marks the matching customer's
-- progress row; the trigger is already defined in the first migration.
