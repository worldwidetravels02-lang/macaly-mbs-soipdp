-- Per-customer access to each project set.
create table if not exists public.customer_project_set_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_name text not null check (level_name in ('Junior Trial','Senior','Master','Expert')),
  set_number smallint not null check (set_number in (1,2,3)),
  is_unlocked boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (user_id, level_name, set_number)
);

alter table public.customer_project_set_access enable row level security;
revoke all on public.customer_project_set_access from anon, authenticated;
grant select, insert, update, delete on public.customer_project_set_access to authenticated;

drop policy if exists "Customers read own project set access" on public.customer_project_set_access;
create policy "Customers read own project set access"
  on public.customer_project_set_access for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Admins manage customer project set access" on public.customer_project_set_access;
create policy "Admins manage customer project set access"
  on public.customer_project_set_access for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create index if not exists customer_project_set_access_user_idx
  on public.customer_project_set_access(user_id, level_name, set_number);

comment on table public.customer_project_set_access is
  'Administrator-controlled unlock status for each project set belonging to one customer.';
