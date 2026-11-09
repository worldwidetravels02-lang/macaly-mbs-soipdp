-- Add the original four project levels and three sets to the existing property catalogue.
-- Existing properties remain unassigned until an administrator edits them.
alter table public.properties
  add column if not exists project_level text,
  add column if not exists set_number smallint,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.properties'::regclass
      and conname = 'properties_project_level_check'
  ) then
    alter table public.properties
      add constraint properties_project_level_check
      check (project_level is null or project_level in ('Junior Trial', 'Senior', 'Master', 'Expert'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.properties'::regclass
      and conname = 'properties_set_number_check'
  ) then
    alter table public.properties
      add constraint properties_set_number_check
      check (set_number is null or set_number in (1, 2, 3));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.properties'::regclass
      and conname = 'properties_project_level_set_pair_check'
  ) then
    alter table public.properties
      add constraint properties_project_level_set_pair_check
      check ((project_level is null and set_number is null) or (project_level is not null and set_number is not null));
  end if;
end $$;

create index if not exists properties_project_catalog_order_idx
  on public.properties (project_level, set_number, sort_order, created_at)
  where status = 'published';

comment on column public.properties.project_level is
  'Original member project level: Junior Trial, Senior, Master, or Expert.';
comment on column public.properties.set_number is
  'Original member project set: 1, 2, or 3.';
comment on column public.properties.sort_order is
  'Administrator-controlled order of projects within a level and set.';
