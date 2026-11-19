-- Require explicit administrator approval before a customer can view or order Junior Trial projects.
-- Preserve all accounts that existed before this workflow as active. New signups have no
-- account_states row and remain pending until an administrator approves them.

insert into public.account_states (user_id, status, reason, updated_at)
select au.id, 'active', 'Existing customer account before approval workflow', now()
from auth.users au
where not exists (
  select 1 from public.account_states s where s.user_id = au.id
)
on conflict (user_id) do nothing;

create or replace function private.is_customer_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_states s
    where s.user_id = (select auth.uid())
      and lower(btrim(coalesce(s.status, ''))) = 'active'
  );
$$;

revoke all on function private.is_customer_approved() from public, anon;
grant execute on function private.is_customer_approved() to authenticated;

create or replace function public.member_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_admin()) or (select private.is_customer_approved());
$$;

revoke all on function public.member_is_approved() from public, anon;
grant execute on function public.member_is_approved() to authenticated;

-- This restrictive policy is ANDed with existing policies, so a permissive
-- project-catalogue policy cannot expose Junior Trial rows to unapproved users.
drop policy if exists "Require admin approval for Junior Trial visibility" on public.properties;
create policy "Require admin approval for Junior Trial visibility"
  on public.properties
  as restrictive
  for select
  to authenticated
  using (
    project_level is distinct from 'Junior Trial'
    or (select private.is_admin())
    or (select private.is_customer_approved())
  );

create or replace function public.require_approved_junior_trial_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_level text;
begin
  if new.plan_code <> 'project_order' or new.property_id is null then
    return new;
  end if;

  select p.project_level
    into v_project_level
    from public.properties p
    where p.id = new.property_id;

  if v_project_level = 'Junior Trial'
     and not (select private.is_admin())
     and not (select private.is_customer_approved()) then
    raise exception 'Your customer account must be approved by an administrator before accessing Junior Trial projects'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.require_approved_junior_trial_customer() from public, anon, authenticated;
drop trigger if exists require_approved_junior_trial_customer on public.investment_requests;
create trigger require_approved_junior_trial_customer
before insert on public.investment_requests
for each row execute function public.require_approved_junior_trial_customer();
