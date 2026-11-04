-- Admin-managed Telegram contact shown on the customer support page.
create table if not exists public.support_settings (
  id text primary key default 'default' check (id = 'default'),
  telegram_username text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint support_settings_telegram_username_valid
    check (telegram_username is null or telegram_username ~ '^[A-Za-z0-9_]{5,32}$')
);

insert into public.support_settings (id, telegram_username)
values ('default', null)
on conflict (id) do nothing;

alter table public.support_settings enable row level security;

drop policy if exists "Anyone can read support contact settings" on public.support_settings;
create policy "Anyone can read support contact settings"
on public.support_settings for select to anon, authenticated
using (true);

drop policy if exists "Admins manage support contact settings" on public.support_settings;
create policy "Admins manage support contact settings"
on public.support_settings for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select on public.support_settings to anon, authenticated;
grant insert, update, delete on public.support_settings to authenticated;
