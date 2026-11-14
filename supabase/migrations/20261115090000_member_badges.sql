-- Member badge progression for Senior, Master and Expert.
-- Junior Trial is intentionally not included.
-- Apply in Supabase SQL Editor after reviewing.

create table if not exists public.project_badges (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('Senior','Master','Expert')),
  badge_number smallint not null check (badge_number between 1 and 3),
  title text not null,
  icon text not null,
  is_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (level, badge_number)
);

create table if not exists public.project_badge_properties (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.project_badges(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  created_at timestamptz not null default now(),
  unique (badge_id, property_id),
  unique (badge_id, position)
);

create table if not exists public.member_badge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.project_badges(id) on delete cascade,
  status text not null default 'locked'
    check (status in ('locked','unlocked','support_requested','completed')),
  support_requested_at timestamptz,
  unlocked_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create table if not exists public.member_project_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.project_badges(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  status text not null default 'ordered'
    check (status in ('ordered','completed','cancelled')),
  ordered_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, badge_id, property_id)
);

create index if not exists project_badges_level_idx
  on public.project_badges(level, badge_number);
create index if not exists badge_properties_badge_position_idx
  on public.project_badge_properties(badge_id, position);
create index if not exists member_badge_progress_user_idx
  on public.member_badge_progress(user_id, status);
create index if not exists member_project_orders_user_badge_idx
  on public.member_project_orders(user_id, badge_id, status);

alter table public.project_badges enable row level security;
alter table public.project_badge_properties enable row level security;
alter table public.member_badge_progress enable row level security;
alter table public.member_project_orders enable row level security;

drop policy if exists "Members read available badges" on public.project_badges;
create policy "Members read available badges"
on public.project_badges for select to authenticated
using (true);

drop policy if exists "Admins manage badges" on public.project_badges;
create policy "Admins manage badges"
on public.project_badges for all to authenticated
using (public.is_msheireb_admin())
with check (public.is_msheireb_admin());

drop policy if exists "Members read badge property assignments" on public.project_badge_properties;
create policy "Members read badge property assignments"
on public.project_badge_properties for select to authenticated
using (true);

drop policy if exists "Admins manage badge property assignments" on public.project_badge_properties;
create policy "Admins manage badge property assignments"
on public.project_badge_properties for all to authenticated
using (public.is_msheireb_admin())
with check (public.is_msheireb_admin());

drop policy if exists "Members read own badge progress" on public.member_badge_progress;
create policy "Members read own badge progress"
on public.member_badge_progress for select to authenticated
using (user_id = (select auth.uid()) or public.is_msheireb_admin());

drop policy if exists "Members request next badge unlock" on public.member_badge_progress;
create policy "Members request next badge unlock"
on public.member_badge_progress for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'support_requested'
  and exists (
    select 1
    from public.project_badges b
    where b.id = badge_id
      and b.is_locked = true
      and b.badge_number > 1
      and exists (
        select 1
        from public.member_badge_progress previous
        where previous.user_id = (select auth.uid())
          and previous.status = 'completed'
          and previous.badge_id in (
            select prior.id from public.project_badges prior
            where prior.level = b.level
              and prior.badge_number = b.badge_number - 1
          )
      )
  )
);

drop policy if exists "Admins manage member badge progress" on public.member_badge_progress;
create policy "Admins manage member badge progress"
on public.member_badge_progress for all to authenticated
using (public.is_msheireb_admin())
with check (public.is_msheireb_admin());

drop policy if exists "Members read own project orders" on public.member_project_orders;
create policy "Members read own project orders"
on public.member_project_orders for select to authenticated
using (user_id = (select auth.uid()) or public.is_msheireb_admin());

drop policy if exists "Members order assigned projects in unlocked badges" on public.member_project_orders;
create policy "Members order assigned projects in unlocked badges"
on public.member_project_orders for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'ordered'
  and exists (
    select 1
    from public.project_badge_properties bp
    join public.project_badges b on b.id = bp.badge_id
    join public.member_badge_progress mp on mp.badge_id = b.id
    where bp.badge_id = member_project_orders.badge_id
      and bp.property_id = member_project_orders.property_id
      and b.is_locked = false
      and mp.user_id = (select auth.uid())
      and mp.status = 'unlocked'
  )
);

drop policy if exists "Admins manage member project orders" on public.member_project_orders;
create policy "Admins manage member project orders"
on public.member_project_orders for all to authenticated
using (public.is_msheireb_admin())
with check (public.is_msheireb_admin());

-- Mark a badge complete automatically when the member has completed all
-- 20 assigned property orders. This keeps progression consistent in Supabase.
create or replace function public.sync_member_badge_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_count integer;
  completed_count integer;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select count(*) into assigned_count
    from public.project_badge_properties
    where badge_id = new.badge_id;

    select count(*) into completed_count
    from public.member_project_orders
    where user_id = new.user_id
      and badge_id = new.badge_id
      and status = 'completed';

    if assigned_count = 20 and completed_count = 20 then
      update public.member_badge_progress
      set status = 'completed',
          completed_at = now(),
          updated_at = now()
      where user_id = new.user_id
        and badge_id = new.badge_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists member_badge_completion_sync on public.member_project_orders;
create trigger member_badge_completion_sync
after update of status on public.member_project_orders
for each row execute function public.sync_member_badge_completion();

-- Seed the nine badge definitions once. Junior Trial is deliberately excluded.
insert into public.project_badges(level, badge_number, title, icon)
values
  ('Senior',1,'Badge 1','gem'),
  ('Senior',2,'Badge 2','trophy'),
  ('Senior',3,'Badge 3','crown'),
  ('Master',1,'Badge 1','gem'),
  ('Master',2,'Badge 2','trophy'),
  ('Master',3,'Badge 3','crown'),
  ('Expert',1,'Badge 1','gem'),
  ('Expert',2,'Badge 2','trophy'),
  ('Expert',3,'Badge 3','crown')
on conflict (level, badge_number) do nothing;
