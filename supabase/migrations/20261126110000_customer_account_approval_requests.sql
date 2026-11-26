-- Customer registration requests require administrator approval before phone login.
create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text
);

alter table public.account_requests enable row level security;
grant select, insert, update on public.account_requests to authenticated;

drop policy if exists "Admins read account requests" on public.account_requests;
create policy "Admins read account requests"
  on public.account_requests for select to authenticated
  using ((select private.is_admin()));

drop policy if exists "Customers submit own account request" on public.account_requests;
create policy "Customers submit own account request"
  on public.account_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
  );

drop policy if exists "Admins review account requests" on public.account_requests;
create policy "Admins review account requests"
  on public.account_requests for update to authenticated
  using ((select private.is_admin()))
  with check (
    (select private.is_admin())
    and status in ('approved', 'rejected')
  );

create index if not exists account_requests_status_created_idx
  on public.account_requests (status, created_at desc);
