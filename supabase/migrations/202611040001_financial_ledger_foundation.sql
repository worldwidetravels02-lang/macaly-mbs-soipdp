-- Msheireb Properties: additive financial ledger foundation.
-- This migration is intentionally separate from the already-applied initial schema.
-- It creates internal wallet records only; it does NOT move real money or run payouts.

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('deposit','withdrawal','investment_funding','profit','admin_credit','admin_debit','refund','adjustment')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'AED' check (currency in ('AED','OMR','SAR','KWD','BHD','QAR')),
  status text not null default 'posted' check (status in ('posted','reversed')),
  reference_type text,
  reference_id uuid,
  idempotency_key text unique,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'AED' check (currency in ('AED','OMR','SAR','KWD','BHD','QAR')),
  payment_method text,
  payment_reference text,
  proof_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'AED' check (currency in ('AED','OMR','SAR','KWD','BHD','QAR')),
  payout_method text,
  payout_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','paid')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'AED' check (currency in ('AED','OMR','SAR','KWD','BHD','QAR')),
  status text not null default 'pending' check (status in ('pending','approved','funded','rejected','completed','cancelled')),
  reference text,
  admin_note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profit_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  investment_id uuid references public.investments(id) on delete set null,
  period_start date not null,
  period_end date not null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'AED' check (currency in ('AED','OMR','SAR','KWD','BHD','QAR')),
  status text not null default 'pending' check (status in ('pending','approved','credited','rejected')),
  idempotency_key text not null unique,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);
create index if not exists topup_requests_user_created_idx on public.topup_requests(user_id, created_at desc);
create index if not exists topup_requests_status_created_idx on public.topup_requests(status, created_at desc);
create index if not exists withdrawal_requests_user_created_idx on public.withdrawal_requests(user_id, created_at desc);
create index if not exists withdrawal_requests_status_created_idx on public.withdrawal_requests(status, created_at desc);
create index if not exists investments_user_created_idx on public.investments(user_id, created_at desc);
create index if not exists profit_payouts_user_period_idx on public.profit_payouts(user_id, period_start, period_end);

alter table public.wallet_transactions enable row level security;
alter table public.topup_requests enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.investments enable row level security;
alter table public.profit_payouts enable row level security;

-- Customers can view only their own financial history. Admin access is controlled
-- exclusively by the admin_members table and private.is_admin().
create policy "Members read own wallet transactions"
on public.wallet_transactions for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Admins insert wallet ledger entries"
on public.wallet_transactions for insert to authenticated
with check ((select private.is_admin()) and created_by = (select auth.uid()));

-- No UPDATE or DELETE policy is intentionally provided for the immutable ledger.

create policy "Members read own topup requests"
on public.topup_requests for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Members submit pending topup requests"
on public.topup_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

create policy "Admins manage topup requests"
on public.topup_requests for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Members read own withdrawal requests"
on public.withdrawal_requests for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Members submit pending withdrawal requests"
on public.withdrawal_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

create policy "Admins manage withdrawal requests"
on public.withdrawal_requests for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Members read own investments"
on public.investments for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Admins manage investments"
on public.investments for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Members read own profit payouts"
on public.profit_payouts for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Admins manage profit payouts"
on public.profit_payouts for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

-- Important: balances must be derived from posted ledger entries. Do not let
-- browser clients write balances or mark requests approved/paid.
-- Approval-to-ledger RPCs and automated payout scheduling are a later,
-- separately reviewed step; no real-money transfer is performed here.
