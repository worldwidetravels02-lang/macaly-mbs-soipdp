-- Keep the customer task workflow consistent with the UI's "returned" state.
-- This is a forward-only correction for installations that already applied 202611090002.
alter table public.member_tasks
  drop constraint if exists member_tasks_status_check;

alter table public.member_tasks
  add constraint member_tasks_status_check
  check (status in ('pending', 'assigned', 'submitted', 'approved', 'rejected', 'returned'));

drop policy if exists "Members submit assigned tasks" on public.member_tasks;
create policy "Members submit assigned tasks" on public.member_tasks
for update to authenticated
using (
  user_id = (select auth.uid())
  and status in ('assigned', 'returned')
)
with check (
  user_id = (select auth.uid())
  and status = 'submitted'
);

grant update (status, submitted_at) on public.member_tasks to authenticated;
