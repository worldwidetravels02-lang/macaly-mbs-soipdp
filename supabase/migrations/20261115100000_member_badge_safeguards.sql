-- Database safeguards for the Senior, Master and Expert badge workflow.
-- Apply after 20261115090000_member_badges.sql. Junior Trial is not affected.

-- A property may appear only once across all three badges in the same level.
-- Also enforce the 20-property maximum and keep assignments editable only while locked.
create or replace function public.guard_project_badge_property_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_badge_id uuid;
  target_property_id uuid;
  target_level text;
  current_count integer;
begin
  target_badge_id := coalesce(new.badge_id, old.badge_id);
  target_property_id := coalesce(new.property_id, old.property_id);

  perform pg_advisory_xact_lock(hashtext('badge-level-assignment-' || target_badge_id::text));

  select level, is_locked into target_level, current_count
  from public.project_badges
  where id = target_badge_id;

  if not found then
    raise exception 'Badge does not exist';
  end if;

  if current_count = 0 then
    raise exception 'Lock the badge before changing its property assignments';
  end if;

  if tg_op <> 'DELETE' then
    select count(*) into current_count
    from public.project_badge_properties
    where badge_id = new.badge_id
      and (tg_op <> 'UPDATE' or id <> new.id);
    if current_count >= 20 then
      raise exception 'A badge can contain no more than 20 properties';
    end if;

    if exists (
      select 1
      from public.project_badge_properties bp
      join public.project_badges other_badge on other_badge.id = bp.badge_id
      where other_badge.level = target_level
        and bp.property_id = new.property_id
        and bp.badge_id <> new.badge_id
    ) then
      raise exception 'This property is already assigned to another badge in this level';
    end if;
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists project_badge_property_assignment_guard on public.project_badge_properties;
create trigger project_badge_property_assignment_guard
before insert or update or delete on public.project_badge_properties
for each row execute function public.guard_project_badge_property_assignment();

-- A badge can be globally unlocked only after exactly 20 properties are assigned.
create or replace function public.guard_project_badge_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_count integer;
begin
  if new.is_locked = false and old.is_locked = true then
    select count(*) into assigned_count
    from public.project_badge_properties
    where badge_id = new.id;
    if assigned_count <> 20 then
      raise exception 'Assign exactly 20 properties before unlocking this badge';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists project_badge_unlock_guard on public.project_badges;
create trigger project_badge_unlock_guard
before update of is_locked on public.project_badges
for each row execute function public.guard_project_badge_unlock();

-- Only one property order may be pending for a member in a badge at a time.
create unique index if not exists member_one_pending_order_per_badge
on public.member_project_orders(user_id, badge_id)
where status = 'ordered';

-- Enforce sequential ordering in the database, not only in the browser.
drop policy if exists "Members order assigned projects in unlocked badges" on public.member_project_orders;
create policy "Members order assigned projects in unlocked badges"
on public.member_project_orders for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'ordered'
  and exists (
    select 1
    from public.project_badge_properties current_assignment
    join public.project_badges b on b.id = current_assignment.badge_id
    join public.member_badge_progress mp on mp.badge_id = b.id
    where current_assignment.badge_id = member_project_orders.badge_id
      and current_assignment.property_id = member_project_orders.property_id
      and b.is_locked = false
      and mp.user_id = (select auth.uid())
      and mp.status = 'unlocked'
      and not exists (
        select 1
        from public.project_badge_properties earlier_assignment
        where earlier_assignment.badge_id = current_assignment.badge_id
          and earlier_assignment.position < current_assignment.position
          and not exists (
            select 1
            from public.member_project_orders earlier_order
            where earlier_order.user_id = (select auth.uid())
              and earlier_order.badge_id = current_assignment.badge_id
              and earlier_order.property_id = earlier_assignment.property_id
              and earlier_order.status = 'completed'
          )
      )
  )
);

-- Prevent a member from changing their own badge identity or unlocking themselves.
-- Members may only change a locked next badge to support_requested after completing
-- the immediately preceding badge. Admins retain their management policy.
create or replace function public.guard_member_badge_progress_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_status text;
  prior_badge_number smallint;
  current_badge_number smallint;
  current_level text;
  current_badge_locked boolean;
begin
  if public.is_msheireb_admin() then
    return new;
  end if;

  if old.user_id <> (select auth.uid())
     or new.user_id <> old.user_id
     or new.badge_id <> old.badge_id
     or old.status <> 'locked'
     or new.status <> 'support_requested' then
    raise exception 'Members may only request an unlock for their next badge';
  end if;

  select b.level, b.badge_number, b.is_locked
    into current_level, current_badge_number, current_badge_locked
  from public.project_badges b
  where b.id = old.badge_id;

  if current_badge_number is null or current_badge_number <= 1 or current_badge_locked = false then
    raise exception 'This badge is not eligible for a support unlock request';
  end if;

  select p.status, b.badge_number
    into prior_status, prior_badge_number
  from public.member_badge_progress p
  join public.project_badges b on b.id = p.badge_id
  where p.user_id = old.user_id
    and b.level = current_level
    and b.badge_number = current_badge_number - 1;

  if prior_status is distinct from 'completed'
     or prior_badge_number is distinct from current_badge_number - 1 then
    raise exception 'Complete the previous badge before requesting the next badge';
  end if;

  new.support_requested_at := coalesce(new.support_requested_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists member_badge_progress_update_guard on public.member_badge_progress;
create trigger member_badge_progress_update_guard
before update on public.member_badge_progress
for each row execute function public.guard_member_badge_progress_update();
