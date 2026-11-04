-- Persist all profile fields collected during Supabase Auth signup.
-- Keep this migration version unique; the auth profile trigger is created in
-- 202611040004_auth_profile_trigger.sql.
alter table public.profiles
  add column if not exists referral_code text;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, mobile, referral_code)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'mobile', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')), '')
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    mobile = coalesce(public.profiles.mobile, excluded.mobile),
    referral_code = coalesce(public.profiles.referral_code, excluded.referral_code);

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
