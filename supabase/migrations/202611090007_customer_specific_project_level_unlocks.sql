-- Per-customer project level access. Unlocks are private to each customer.
create table if not exists public.customer_project_level_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_name text not null check (level_name in ('Junior Trial','Senior','Master','Expert')),
  is_unlocked boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (user_id, level_name)
);

alter table public.customer_project_level_access enable row level security;
revoke all on public.customer_project_level_access from anon, authenticated;
grant select, insert, update, delete on public.customer_project_level_access to authenticated;

drop policy if exists "Customers read their own project level access" on public.customer_project_level_access;
create policy "Customers read their own project level access"
  on public.customer_project_level_access for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

drop policy if exists "Admins manage customer project level access" on public.customer_project_level_access;
create policy "Admins manage customer project level access"
  on public.customer_project_level_access for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create index if not exists customer_project_level_access_user_idx
  on public.customer_project_level_access(user_id, level_name);

comment on table public.customer_project_level_access is
  'Administrator-controlled project level unlocks for individual customers; no global customer unlock.';
