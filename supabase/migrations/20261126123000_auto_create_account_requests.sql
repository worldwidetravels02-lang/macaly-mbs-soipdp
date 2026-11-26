-- Ensure every newly created Auth user gets a pending administrator-review request,
-- even when Supabase email confirmation prevents the browser from receiving a session.
create or replace function public.create_account_request_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_requests (user_id, status)
  values (new.id, 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_account_request_for_new_auth_user() from public, anon, authenticated;

drop trigger if exists create_account_request_after_auth_signup on auth.users;
create trigger create_account_request_after_auth_signup
after insert on auth.users
for each row
execute function public.create_account_request_for_new_auth_user();

-- Repair registration requests created during the approval rollout that were
-- missing because the old browser flow required an immediate Auth session.
insert into public.account_requests (user_id, status)
select id, 'pending'
from auth.users
where created_at >= timestamptz '2026-11-26 11:58:00+00'
on conflict (user_id) do nothing;
