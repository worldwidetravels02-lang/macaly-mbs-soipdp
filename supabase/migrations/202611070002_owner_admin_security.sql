-- Msheireb Properties: explicit Owner/Admin roles and owner PIN verification.
-- The existing earliest administrator remains the initial owner.
create extension if not exists pgcrypto with schema extensions;

alter table public.admin_members
  add column if not exists role text not null default 'admin';

alter table public.admin_members
  drop constraint if exists admin_members_role_check;

alter table public.admin_members
  add constraint admin_members_role_check
  check (role in ('owner', 'admin'));

with initial_owner as (
  select user_id
  from public.admin_members
  order by created_at asc nulls last, user_id asc
  limit 1
)
update public.admin_members
set role = case
  when user_id = (select user_id from initial_owner) then 'owner'
  else 'admin'
end;

create unique index if not exists admin_members_one_owner_idx
  on public.admin_members ((role))
  where role = 'owner';

create table if not exists public.owner_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_pin_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_pin_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_until timestamptz not null
);

alter table public.owner_security enable row level security;
alter table public.owner_pin_attempts enable row level security;
alter table public.owner_pin_sessions enable row level security;

revoke all on public.owner_security, public.owner_pin_attempts, public.owner_pin_sessions from anon, authenticated;

create or replace function public.owner_set_pin(p_new_pin text, p_current_pin text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_hash text;
  v_verified boolean := false;
begin
  if v_uid is null or not exists (
    select 1 from public.admin_members where user_id = v_uid and role = 'owner'
  ) then
    raise exception 'Only the owner can set the owner security code';
  end if;

  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'The owner security code must be exactly four digits';
  end if;

  select pin_hash into v_existing_hash
  from public.owner_security where user_id = v_uid;

  if v_existing_hash is not null then
    if p_current_pin is null then
      raise exception 'Enter your current owner code before changing it';
    end if;
    v_verified := extensions.crypt(p_current_pin, v_existing_hash) = v_existing_hash;
    if not v_verified then
      raise exception 'Current owner code is incorrect';
    end if;
  end if;

  insert into public.owner_security(user_id, pin_hash, updated_at)
  values (v_uid, extensions.crypt(p_new_pin, extensions.gen_salt('bf')), now())
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();

  delete from public.owner_pin_attempts where user_id = v_uid;
  delete from public.owner_pin_sessions where user_id = v_uid;
end;
$$;

create or replace function public.owner_verify_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_locked_until timestamptz;
  v_failed integer;
begin
  if v_uid is null or not exists (
    select 1 from public.admin_members where user_id = v_uid and role = 'owner'
  ) then
    raise exception 'Owner account required';
  end if;

  select locked_until, failed_attempts
    into v_locked_until, v_failed
  from public.owner_pin_attempts where user_id = v_uid;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Too many incorrect codes. Try again later';
  end if;

  select pin_hash into v_hash from public.owner_security where user_id = v_uid;
  if v_hash is null then
    raise exception 'Owner security code has not been created';
  end if;

  if p_pin is not null and p_pin ~ '^[0-9]{4}$'
     and extensions.crypt(p_pin, v_hash) = v_hash then
    insert into public.owner_pin_attempts(user_id, failed_attempts, locked_until, updated_at)
    values (v_uid, 0, null, now())
    on conflict (user_id) do update
      set failed_attempts = 0, locked_until = null, updated_at = now();

    insert into public.owner_pin_sessions(user_id, verified_until)
    values (v_uid, now() + interval '8 hours')
    on conflict (user_id) do update
      set verified_until = excluded.verified_until;
    return true;
  end if;

  v_failed := coalesce(v_failed, 0) + 1;
  insert into public.owner_pin_attempts(user_id, failed_attempts, locked_until, updated_at)
  values (
    v_uid,
    v_failed,
    case when v_failed >= 5 then now() + interval '15 minutes' else null end,
    now()
  )
  on conflict (user_id) do update
    set failed_attempts = excluded.failed_attempts,
        locked_until = excluded.locked_until,
        updated_at = now();

  return false;
end;
$$;

create or replace function public.owner_is_verified()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.admin_members am
    join public.owner_pin_sessions s on s.user_id = am.user_id
    where am.user_id = auth.uid()
      and am.role = 'owner'
      and s.verified_until > now()
  );
$$;

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
declare
  v_uid uuid := auth.uid();
  v_target_id uuid;
begin
  if v_uid is null
     or not exists (select 1 from public.admin_members where admin_members.user_id = v_uid and admin_members.role = 'owner')
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
    update public.admin_members set role = 'admin'
      where admin_members.user_id = p_user_id and admin_members.role = 'admin';

  elsif p_action = 'transfer_owner' then
    if p_user_id is null or p_user_id = v_uid then
      raise exception 'Select another administrator for ownership transfer';
    end if;
    if not exists (select 1 from public.admin_members where admin_members.user_id = p_user_id and admin_members.role = 'admin') then
      raise exception 'The new owner must already be an administrator';
    end if;
    update public.admin_members set role = 'admin'
      where admin_members.user_id = v_uid and admin_members.role = 'owner';
    update public.admin_members set role = 'owner'
      where admin_members.user_id = p_user_id;

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

revoke all on function public.owner_set_pin(text, text) from public;
revoke all on function public.owner_verify_pin(text) from public;
revoke all on function public.owner_is_verified() from public;
revoke all on function public.admin_manage_access(text, text, uuid, text) from public;

grant execute on function public.owner_set_pin(text, text) to authenticated;
grant execute on function public.owner_verify_pin(text) to authenticated;
grant execute on function public.owner_is_verified() to authenticated;
grant execute on function public.admin_manage_access(text, text, uuid, text) to authenticated;
