-- Store administrator-controlled progress for each customer's badge.
alter table public.customer_project_set_access
  add column if not exists progress_percent numeric(5,2) not null default 0
  check (progress_percent >= 0 and progress_percent <= 100);

comment on column public.customer_project_set_access.progress_percent is
  'Progress percentage manually set by an administrator for this customer badge.';
