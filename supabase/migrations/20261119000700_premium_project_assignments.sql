-- Customer-specific Premium Project assignments for exact badge positions.
-- These assignments configure a project prompt; they do not move or alter the customer's property progression.

create table if not exists public.premium_project_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_name text not null check (level_name in ('Senior','Master','Expert')),
  badge_number smallint not null check (badge_number between 1 and 3),
  position smallint not null check (position between 1 and 20),
  project_name text not null check (char_length(btrim(project_name)) between 1 and 160),
  deposit_amount numeric(20,2) not null check (deposit_amount > 0 and deposit_amount <= 100000000),
  commission_percent numeric(7,4) not null check (commission_percent between 0 and 100),
  currency text not null default 'OMR' check (currency = 'OMR'),
  status text not null default 'active' check (status in ('active','presented','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  presented_at timestamptz,
  unique (user_id, level_name, badge_number, position)
);

create index if not exists premium_project_assignments_user_position_idx
  on public.premium_project_assignments(user_id, level_name, badge_number, position);

alter table public.premium_project_assignments enable row level security;
revoke all on public.premium_project_assignments from anon, authenticated;
grant select, insert, update, delete on public.premium_project_assignments to authenticated;

drop policy if exists "Customers read own Premium Project assignments" on public.premium_project_assignments;
create policy "Customers read own Premium Project assignments"
  on public.premium_project_assignments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Admins manage Premium Project assignments" on public.premium_project_assignments;
create policy "Admins manage Premium Project assignments"
  on public.premium_project_assignments for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

comment on table public.premium_project_assignments is
  'Admin-configured Premium Project prompt assigned to one customer at one exact level, badge, and property position.';
