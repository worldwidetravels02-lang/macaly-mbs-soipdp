-- Allow customers to read only the public Telegram support contact.
-- Admin write access remains governed by the existing support_settings policies.
grant select (id, telegram_username) on table public.support_settings to anon, authenticated;

drop policy if exists "Public can read Telegram support contact" on public.support_settings;
create policy "Public can read Telegram support contact"
  on public.support_settings
  for select
  to anon, authenticated
  using (true);
