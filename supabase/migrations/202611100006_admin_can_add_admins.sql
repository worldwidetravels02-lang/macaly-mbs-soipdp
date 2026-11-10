-- Allow existing administrators to add other administrator accounts.
-- Only the owner can remove administrators or transfer/change ownership.
create or replace function public.admin_manage_access(
  p_action text,
  p_email text default null,
  p_user_id uuid default null,
  p_new_role text default 'admin'
)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz,
  is_owner boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_actor_role text;
  v_owner_id uuid;
  v_target_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in is required';
  end if;

  select am.role into v_actor_role
  from public.admin_members am
  where am.user_id = v_uid;

  if v_actor_role is null then
    raise exception 'Administrator access is required';
  end if;

  select am.user_id into v_owner_id
  from public.admin_members am
  where am.role = 'owner'
  order by am.created_at asc nulls last, am.user_id asc
  limit 1;

  if p_action = 'add' then
    if v_actor_role = 'owner' and not public.owner_is_verified() then
      raise exception 'Verify the owner security code before adding administrators';
    end if;
    if p_email is null or btrim(p_email) = '' then
      raise exception 'Enter the registered email address';
    end if;
    if p_new_role not in ('admin') then
      raise exception 'New accounts can only be added as administrators';
    end if;
    select u.id into v_target_id
    from auth.users u
    where lower(u.email) = lower(btrim(p_email))
    limit 1;
    if v_target_id is null then
      raise exception 'No login account exists for this email';
    end if;
    if v_target_id = v_uid then
      raise exception 'You cannot add your own account again';
    end if;
    insert into public.admin_members(user_id, role)
    values (v_target_id, 'admin')
    on conflict (user_id) do update set role = 'admin';

  elsif p_action = 'remove' then
    if v_actor_role <> 'owner' or not public.owner_is_verified() then
      raise exception 'Only the verified owner can remove administrator access';
    end if;
    if p_user_id is null then raise exception 'Select an administrator'; end if;
    if p_user_id = v_owner_id then raise exception 'The owner account cannot be removed'; end if;
    delete from public.admin_members am
    where am.user_id = p_user_id and am.role = 'admin';

  elsif p_action = 'change_role' or p_action = 'transfer_owner' then
    if v_actor_role <> 'owner' or not public.owner_is_verified() then
      raise exception 'Only the verified owner can change administrator roles';
    end if;
    raise exception 'Ownership changes must use the owner transfer workflow';

  elsif p_action <> 'list' then
    raise exception 'Unsupported administrator action';
  end if;

  return query
  select am.user_id, u.email::text, am.role::text, am.created_at,
         (am.role = 'owner') as is_owner
  from public.admin_members am
  left join auth.users u on u.id = am.user_id
  order by case when am.role = 'owner' then 0 else 1 end, am.created_at asc;
end;
$$;

revoke all on function public.admin_manage_access(text, text, uuid, text) from public;
grant execute on function public.admin_manage_access(text, text, uuid, text) to authenticated;
