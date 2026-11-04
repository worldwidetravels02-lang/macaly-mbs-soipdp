-- Msheireb Properties: disable card and cryptocurrency payment processing.
-- Customer deposits are requests handled through customer support. Administrators
-- manually review requests after confirming receipt outside this application.
-- This migration is additive and safe whether the legacy provider functions exist or not.

-- Remove any legacy crypto submission/review/ledger-credit workflow.
drop function if exists public.admin_review_crypto_payment(uuid, boolean, text);
drop table if exists public.crypto_payments;
alter table public.payment_details drop column if exists crypto;

-- Remove the legacy Stripe webhook finalizer. No card checkout is supported.
drop function if exists public.finalize_stripe_payment(text, boolean);

-- Prevent customers from creating provider payment intents or reservation charges.
drop policy if exists "Members create test payment intents" on public.payments;
drop policy if exists "Members create test reservation deposits" on public.reservation_deposits;
revoke insert on public.payments from authenticated;
revoke insert on public.reservation_deposits from authenticated;

-- Keep historical payment records available to administrators for audit purposes.
-- No new card/crypto transactions can be submitted or finalized through these paths.
