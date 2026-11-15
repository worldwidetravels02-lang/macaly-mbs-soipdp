-- Editable customer-support Telegram contact.
create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "Public can read support Telegram setting" on public.site_settings;
create policy "Public can read support Telegram setting"
on public.site_settings for select
to anon, authenticated
using (setting_key = 'support_telegram_id');

drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings"
on public.site_settings for all
to authenticated
using (
  exists (
    select 1 from public.admin_members
    where user_id = (select auth.uid()) and role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.admin_members
    where user_id = (select auth.uid()) and role = 'admin'
  )
);

insert into public.site_settings (setting_key, setting_value)
values ('support_telegram_id', '')
on conflict (setting_key) do nothing;
