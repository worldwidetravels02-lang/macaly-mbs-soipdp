create or replace function public.require_valid_signup_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if upper(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))) <> 'AA234' then
    raise exception 'A valid referral code is required.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists require_valid_signup_referral_code on auth.users;
create trigger require_valid_signup_referral_code
before insert on auth.users
for each row
execute function public.require_valid_signup_referral_code();