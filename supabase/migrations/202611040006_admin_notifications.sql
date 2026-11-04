-- Allow verified administrators to create customer notifications.
-- Existing customer read/update policies remain unchanged.
create policy "Admins create customer notifications"
on public.notifications for insert to authenticated
with check (
  (select private.is_admin())
  and user_id is not null
  and length(trim(title)) between 1 and 160
  and length(trim(body)) between 1 and 4000
);
