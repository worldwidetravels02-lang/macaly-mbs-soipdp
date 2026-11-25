revoke update on table public.premium_project_assignments from authenticated;
grant update (status, presented_at) on table public.premium_project_assignments to authenticated;

drop policy if exists "Customers present own Premium Project assignments" on public.premium_project_assignments;
create policy "Customers present own Premium Project assignments"
on public.premium_project_assignments
for update
to authenticated
using (user_id = (select auth.uid()) and status = 'active')
with check (user_id = (select auth.uid()) and status = 'presented');
