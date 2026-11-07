-- Fix PL/pgSQL ambiguity between RETURNS TABLE output names and table columns.
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
  v_target_id uuid;
begin
  if v_uid is null
     or not exists (
       select 1 from public.admin_members am
       where am.user_id = v_uid and am.role = 'owner'
     )
     or not public.owner_is_verified() then
    raise exception 'Owner access and a verified owner code are required';
  end if;

  if p_action = 'add' then
    if p_email is null or btrim(p_email) = '' then
      raise exception 'Enter the staff email address';
    end if;
    if p_new_role not in ('admin') then
      raise exception 'New staff can only be added as administrators';
    end if;
    select u.id into v_target_id
      from auth.users u
      where lower(u.email) = lower(btrim(p_email))
      limit 1;
    if v_target_id is null then
      raise exception 'No login account exists for this email. Staff account creation will be added separately.';
    end if;
    if v_target_id = v_uid then
      raise exception 'The owner cannot add themselves as an administrator';
    end if;
    insert into public.admin_members(user_id, role)
      values (v_target_id, 'admin')
      on conflict (user_id) do update set role = 'admin';

  elsif p_action = 'remove' then
    if p_user_id is null then raise exception 'Select an administrator'; end if;
    if p_user_id = v_uid then raise exception 'The owner cannot remove their own access here'; end if;
    delete from public.admin_members am
      where am.user_id = p_user_id and am.role = 'admin';

  elsif p_action = 'change_role' then
    if p_user_id is null or p_user_id = v_uid then
      raise exception 'Select another administrator';
    end if;
    if p_new_role not in ('admin') then
      raise exception 'Use the ownership transfer action to change the owner';
    end if;
    update public.admin_members am set role = 'admin'
      where am.user_id = p_user_id and am.role = 'admin';

  elsif p_action = 'transfer_owner' then
    if p_user_id is null or p_user_id = v_uid then
      raise exception 'Select another administrator for ownership transfer';
    end if;
    if not exists (
      select 1 from public.admin_members am
      where am.user_id = p_user_id and am.role = 'admin'
    ) then
      raise exception 'The new owner must already be an administrator';
    end if;
    update public.admin_members am set role = 'admin'
      where am.user_id = v_uid and am.role = 'owner';
    update public.admin_members am set role = 'owner'
      where am.user_id = p_user_id;

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
