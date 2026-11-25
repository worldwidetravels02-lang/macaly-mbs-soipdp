-- Persist one-time customer dismissal of each project completion popup.
create table if not exists public.member_project_completion_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_name text not null check (level_name in ('Junior Trial','Senior','Master','Expert')),
  set_number smallint not null check (set_number between 1 and 3),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, level_name, set_number)
);

alter table public.member_project_completion_dismissals enable row level security;
revoke all on public.member_project_completion_dismissals from anon, authenticated;
grant select on public.member_project_completion_dismissals to authenticated;

drop policy if exists "Members read own project completion dismissals" on public.member_project_completion_dismissals;
create policy "Members read own project completion dismissals"
  on public.member_project_completion_dismissals
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.dismiss_member_project_completion_popup(
  p_level_name text,
  p_set_number smallint
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_level_name not in ('Junior Trial','Senior','Master','Expert')
     or p_set_number not between 1 and 3 then
    raise exception 'Invalid project progression' using errcode = '22023';
  end if;

  insert into public.member_project_completion_dismissals(user_id, level_name, set_number)
  values (v_user_id, p_level_name, p_set_number)
  on conflict (user_id, level_name, set_number) do nothing;
end;
$function$;

revoke all on function public.dismiss_member_project_completion_popup(text, smallint) from public, anon;
grant execute on function public.dismiss_member_project_completion_popup(text, smallint) to authenticated;
