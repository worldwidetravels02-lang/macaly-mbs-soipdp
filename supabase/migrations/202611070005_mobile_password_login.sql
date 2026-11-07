-- Resolve a customer's email from their mobile number only inside a trusted Edge Function.
-- The function returns an email only to service_role, never to browser users.
create or replace function public.auth_email_for_mobile(p_mobile text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_email text;
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g');
  if length(v_digits) < 7 or length(v_digits) > 15 then
    return null;
  end if;

  select count(*), min(u.email)
    into v_count, v_email
  from auth.users as u
  join public.profiles as p on p.id = u.id
  where regexp_replace(coalesce(p.mobile, ''), '[^0-9]', '', 'g') = v_digits
    and u.email is not null;

  -- Refuse ambiguous numbers rather than selecting the wrong account.
  if v_count <> 1 then
    return null;
  end if;

  return v_email;
end;
$$;

revoke all on function public.auth_email_for_mobile(text) from public, anon, authenticated;
grant execute on function public.auth_email_for_mobile(text) to service_role;
