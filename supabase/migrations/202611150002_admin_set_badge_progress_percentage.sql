-- Store administrator-controlled progress for each customer's individual project badge.
alter table public.customer_project_set_access
  add column if not exists progress_percent smallint not null default 0
  check (progress_percent between 0 and 100);

comment on column public.customer_project_set_access.progress_percent is
  'Progress percentage manually set by an administrator for this customer and badge; customers can only view it.';
