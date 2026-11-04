-- Payment operations are managed by administrators only.
-- Customers retain read-only wallet balances and posted ledger history.
drop policy if exists "Authenticated members read payment details" on public.payment_details;
drop policy if exists "Members read own topup requests" on public.topup_requests;
drop policy if exists "Members submit pending topup requests" on public.topup_requests;
drop policy if exists "Members read own withdrawal requests" on public.withdrawal_requests;
drop policy if exists "Members submit pending withdrawal requests" on public.withdrawal_requests;

-- Explicit admin-only read access; existing admin write/review policies remain.
drop policy if exists "Admins read payment details" on public.payment_details;
create policy "Admins read payment details"
on public.payment_details for select to authenticated
using ((select private.is_admin()));

-- The existing "Admins read topup requests", "Admins read withdrawal requests",
-- and "Admins manage payment details" policies remain in force.
