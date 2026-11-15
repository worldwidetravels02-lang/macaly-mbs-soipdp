-- Badge progression support-request policy correction.
-- The comprehensive property-assignment safeguards are defined in
-- 20261115100000_member_badge_safeguards.sql; avoid installing a duplicate
-- property-assignment trigger here.

-- A customer may request the next badge once the previous badge is completed.
-- The global badge lock is an admin catalogue control; it must not block the
-- customer's support-request action.
drop policy if exists "Members request next badge unlock" on public.member_badge_progress;
create policy "Members request next badge unlock"
on public.member_badge_progress for update to authenticated
using (
  user_id = (select auth.uid())
  and status = 'locked'
  and exists (
    select 1
    from public.project_badges b
    join public.member_badge_progress previous
      on previous.user_id = (select auth.uid())
    join public.project_badges prior
      on prior.id = previous.badge_id
     and prior.level = b.level
     and prior.badge_number = b.badge_number - 1
    where b.id = member_badge_progress.badge_id
      and b.badge_number > 1
      and previous.status = 'completed'
  )
)
with check (
  user_id = (select auth.uid())
  and status = 'support_requested'
);

-- Ensure each badge completion update only marks the matching customer's
-- progress row; the trigger is already defined in the first migration.
