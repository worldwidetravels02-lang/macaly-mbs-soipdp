-- Project catalogue: 4 original levels, 3 sets per level, 20 editable sample cards per set.
alter table public.properties
  add column if not exists project_level text,
  add column if not exists set_number smallint,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.properties'::regclass and conname='properties_project_level_check') then
    alter table public.properties add constraint properties_project_level_check
      check (project_level is null or project_level in ('Junior Trial','Senior','Master','Expert'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.properties'::regclass and conname='properties_set_number_check') then
    alter table public.properties add constraint properties_set_number_check
      check (set_number is null or set_number in (1,2,3));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.properties'::regclass and conname='properties_project_level_set_pair_check') then
    alter table public.properties add constraint properties_project_level_set_pair_check
      check ((project_level is null and set_number is null) or (project_level is not null and set_number is not null));
  end if;
end $$;

create index if not exists properties_project_catalog_order_idx
  on public.properties (project_level, set_number, sort_order, created_at);

create table if not exists public.project_level_settings (
  level_name text primary key check (level_name in ('Junior Trial','Senior','Master','Expert')),
  is_unlocked boolean not null default false,
  display_order smallint not null unique check (display_order between 1 and 4),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.project_level_settings enable row level security;
revoke all on public.project_level_settings from anon;
revoke all on public.project_level_settings from authenticated;
grant select, insert, update, delete on public.project_level_settings to authenticated;

drop policy if exists "Members read project level settings" on public.project_level_settings;
create policy "Members read project level settings"
  on public.project_level_settings for select to authenticated using (true);
drop policy if exists "Admins manage project level settings" on public.project_level_settings;
create policy "Admins manage project level settings"
  on public.project_level_settings for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

insert into public.project_level_settings (level_name,is_unlocked,display_order)
values
  ('Junior Trial',true,1),
  ('Senior',false,2),
  ('Master',false,3),
  ('Expert',false,4)
on conflict (level_name) do nothing;

-- Add only clearly labelled sample placeholders; administrators can replace every field.
insert into public.properties
  (slug,name,location,description,price_label,cover_image_url,status,project_level,set_number,sort_order)
select
  lower(replace(level_name,' ','-')) || '-set-' || set_no || '-sample-' || lpad(project_no::text,2,'0'),
  'Sample Project ' || lpad(project_no::text,2,'0'),
  'Dubai, UAE',
  'Sample placeholder project. An administrator must replace this description, image and price before accepting an order.',
  'Sample — price to be set by admin',
  null,
  'published',
  level_name,
  set_no,
  project_no
from (values ('Junior Trial'),('Senior'),('Master'),('Expert')) as levels(level_name)
cross join generate_series(1,3) as sets(set_no)
cross join generate_series(1,20) as projects(project_no)
on conflict (slug) do nothing;

comment on column public.properties.project_level is 'Original project level: Junior Trial, Senior, Master, or Expert.';
comment on column public.properties.set_number is 'Project set number: 1, 2, or 3.';
comment on column public.properties.sort_order is 'Admin-controlled display order within each level and set.';
