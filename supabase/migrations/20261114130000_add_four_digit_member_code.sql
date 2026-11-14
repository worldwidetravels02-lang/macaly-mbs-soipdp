-- Assign each customer a stable, unique four-digit member number.
-- UUIDs remain unchanged and continue to be used internally for relationships.
create sequence if not exists public.member_code_seq
  as integer
  minvalue 1000
  maxvalue 9999
  start with 1000
  increment by 1
  no cycle;

alter table public.profiles
  add column if not exists member_code integer;

do $$
declare
  missing_count bigint;
begin
  select count(*) into missing_count
  from public.profiles
  where member_code is null;

  if missing_count > 9000 then
    raise exception 'Cannot assign four-digit member numbers: more than 9000 profiles exist.';
  end if;
end $$;

with numbered as (
  select id,
         999 + row_number() over (order by created_at nulls first, id) as code
  from public.profiles
  where member_code is null
)
update public.profiles as p
set member_code = numbered.code
from numbered
where p.id = numbered.id;

select setval(
  'public.member_code_seq',
  greatest(999, coalesce((select max(member_code) from public.profiles), 999)),
  true
);

alter table public.profiles
  alter column member_code set default nextval('public.member_code_seq');

create unique index if not exists profiles_member_code_unique
  on public.profiles (member_code);

alter table public.profiles
  alter column member_code set not null;
