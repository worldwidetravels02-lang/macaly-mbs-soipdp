-- Ensure registration metadata is copied into the customer profile.
-- This keeps mobile/password login working without enabling SMS authentication.

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, full_name, mobile)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'mobile'), '')
  )
  on conflict (id) do update
    set full_name = coalesce(
          nullif(btrim(excluded.full_name), ''),
          public.profiles.full_name
        ),
        mobile = coalesce(
          nullif(btrim(excluded.mobile), ''),
          public.profiles.mobile
        );

  return new;
end;
$$;

drop trigger if exists sync_auth_user_profile on auth.users;
create trigger sync_auth_user_profile
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_profile();

-- Backfill profiles for accounts already registered before this trigger existed.
insert into public.profiles (id, full_name, mobile)
select
  u.id,
  nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(u.raw_user_meta_data ->> 'mobile'), '')
from auth.users u
where nullif(btrim(u.raw_user_meta_data ->> 'mobile'), '') is not null
on conflict (id) do update
  set full_name = coalesce(
        nullif(btrim(excluded.full_name), ''),
        public.profiles.full_name
      ),
      mobile = coalesce(
        nullif(btrim(excluded.mobile), ''),
        public.profiles.mobile
      );
