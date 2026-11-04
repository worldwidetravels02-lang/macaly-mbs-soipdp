-- Persist the additional profile fields collected by Supabase Auth signup.
-- Safe to apply more than once.
alter table public.profiles
  add column if not exists referral_code text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, mobile, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'mobile', ''),
    nullif(new.raw_user_meta_data->>'referral_code', '')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    mobile = coalesce(excluded.mobile, public.profiles.mobile),
    referral_code = coalesce(excluded.referral_code, public.profiles.referral_code),
    updated_at = now();
  return new;
end;
$$;
