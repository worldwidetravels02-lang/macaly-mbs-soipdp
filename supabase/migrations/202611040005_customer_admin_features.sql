-- Msheireb Properties: additive customer and admin feature schema.
-- Apply only after the existing initial and wallet migrations.
-- This migration creates data structures and RLS; it does not activate payment processing.

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  address text,
  referral_code text unique,
  interest text,
  membership_level integer not null default 0 check (membership_level >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  detail text,
  target_level integer not null check (target_level >= 0),
  status text not null default 'pending' check (status in ('pending','submitted','approved','rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.payment_details (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  iban text not null default '',
  swift text not null default '',
  note text not null default '',
  crypto jsonb not null default '[]'::jsonb check (jsonb_typeof(crypto) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.crypto_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('topup','deposit','investment')),
  property_id uuid references public.properties(id) on delete set null,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'AED' check (currency in ('AED','OMR','SAR','KWD','BHD','QAR')),
  coin text not null,
  network text not null,
  destination_address text not null,
  transaction_hash text,
  proof_url text,
  proof_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  level integer not null check (level >= 0),
  name text not null,
  minimum_amount numeric(20,2) not null default 0 check (minimum_amount >= 0),
  profit_percent numeric(8,4) not null default 0 check (profit_percent >= 0),
  commission_percent numeric(8,4) not null default 0 check (commission_percent >= 0),
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.investment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  property_name text not null,
  plan_code text not null,
  amount numeric(20,2) not null check (amount > 0),
  expected_profit numeric(20,2) check (expected_profit is null or expected_profit >= 0),
  expected_commission numeric(20,2) check (expected_commission is null or expected_commission >= 0),
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','funded')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  funded_at timestamptz,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete restrict
);

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  document_url text not null,
  document_name text not null,
  document_type text not null,
  note text,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.account_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','frozen','blocked')),
  reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.property_prices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  slug text not null unique,
  price_label text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.fx_rates (
  code text primary key,
  label text not null,
  aed_per_unit numeric(20,8) not null check (aed_per_unit > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null,
  excerpt text not null,
  content text not null,
  cover_image_url text,
  author_name text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('topup','deposit')),
  amount numeric(20,2) not null check (amount > 0),
  amount_charged numeric(20,2) not null check (amount_charged > 0),
  currency text not null,
  aed_per_unit numeric(20,8) not null check (aed_per_unit > 0),
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','paid','expired')),
  provider text,
  provider_session_id text unique,
  mode text not null default 'test' check (mode in ('test','live')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.reservation_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  property_name text not null,
  amount numeric(20,2) not null check (amount > 0),
  amount_charged numeric(20,2) not null check (amount_charged > 0),
  currency text not null,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  mode text not null default 'test' check (mode in ('test','live')),
  created_at timestamptz not null default now()
);

create index if not exists member_tasks_user_created_idx on public.member_tasks(user_id, created_at desc);
create index if not exists member_tasks_status_created_idx on public.member_tasks(status, created_at desc);
create index if not exists crypto_payments_user_created_idx on public.crypto_payments(user_id, created_at desc);
create index if not exists crypto_payments_status_created_idx on public.crypto_payments(status, created_at desc);
create index if not exists investment_requests_user_created_idx on public.investment_requests(user_id, created_at desc);
create index if not exists investment_requests_status_created_idx on public.investment_requests(status, created_at desc);
create index if not exists verifications_user_created_idx on public.verifications(user_id, submitted_at desc);
create index if not exists verifications_status_created_idx on public.verifications(status, submitted_at desc);
create index if not exists payments_user_created_idx on public.payments(user_id, created_at desc);
create index if not exists posts_published_idx on public.posts(published, published_at desc);

alter table public.member_profiles enable row level security;
alter table public.member_tasks enable row level security;
alter table public.payment_details enable row level security;
alter table public.crypto_payments enable row level security;
alter table public.membership_plans enable row level security;
alter table public.investment_requests enable row level security;
alter table public.verifications enable row level security;
alter table public.account_states enable row level security;
alter table public.property_prices enable row level security;
alter table public.fx_rates enable row level security;
alter table public.posts enable row level security;
alter table public.payments enable row level security;
alter table public.reservation_deposits enable row level security;

create policy "Members read own extended profile" on public.member_profiles
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members insert own extended profile" on public.member_profiles
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Members update own extended profile" on public.member_profiles
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "Admins manage extended profiles" on public.member_profiles
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Members read own tasks" on public.member_tasks
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members submit assigned tasks" on public.member_tasks
for update to authenticated using (user_id = (select auth.uid()) and status in ('pending','rejected'))
with check (user_id = (select auth.uid()) and status = 'submitted');
create policy "Admins manage member tasks" on public.member_tasks
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Authenticated members read payment details" on public.payment_details
for select to authenticated using (true);
create policy "Admins manage payment details" on public.payment_details
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Members read own crypto payments" on public.crypto_payments
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members submit crypto payments" on public.crypto_payments
for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null);
create policy "Admins manage crypto payments" on public.crypto_payments
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Active membership plans are public" on public.membership_plans
for select to anon, authenticated using (active or (select private.is_admin()));
create policy "Admins manage membership plans" on public.membership_plans
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Members read own investment requests" on public.investment_requests
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members create investment requests" on public.investment_requests
for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null and funded_at is null);
create policy "Admins manage investment requests" on public.investment_requests
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Members read own verification" on public.verifications
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members submit verification" on public.verifications
for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null);
create policy "Admins manage verifications" on public.verifications
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Members read own account state" on public.account_states
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins manage account states" on public.account_states
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Property prices are public" on public.property_prices
for select to anon, authenticated using (true);
create policy "Admins manage property prices" on public.property_prices
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "FX rates are public" on public.fx_rates
for select to anon, authenticated using (true);
create policy "Admins manage FX rates" on public.fx_rates
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Published posts are public" on public.posts
for select to anon, authenticated using (published or (select private.is_admin()));
create policy "Admins manage posts" on public.posts
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Members read own payments" on public.payments
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members create test payment intents" on public.payments
for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending' and mode = 'test' and paid_at is null);
create policy "Admins read payment records" on public.payments
for select to authenticated using ((select private.is_admin()));

create policy "Members read own reservation deposits" on public.reservation_deposits
for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Members create test reservation deposits" on public.reservation_deposits
for insert to authenticated with check (user_id = (select auth.uid()) and mode = 'test');

grant select on public.membership_plans, public.property_prices, public.fx_rates, public.posts to anon, authenticated;
grant select on public.member_profiles, public.member_tasks, public.payment_details,
  public.crypto_payments, public.investment_requests, public.verifications,
  public.account_states, public.payments, public.reservation_deposits to authenticated;
revoke insert, update on public.member_profiles from authenticated;
grant insert (user_id, address, interest) on public.member_profiles to authenticated;
grant update (address, interest) on public.member_profiles to authenticated;
revoke update on public.member_tasks from authenticated;
grant update (status, submitted_at) on public.member_tasks to authenticated;
grant insert on public.crypto_payments, public.investment_requests, public.verifications,
  public.payments, public.reservation_deposits to authenticated;
grant select, insert, update, delete on public.payment_details, public.membership_plans,
  public.account_states, public.property_prices, public.fx_rates, public.posts,
  public.crypto_payments, public.investment_requests, public.verifications,
  public.member_tasks to authenticated;

-- Card-payment rows are intent records only. A verified server-side provider webhook
-- must be added before any row can be marked paid or any wallet can be credited.
-- Identity document URLs must point to private storage objects with their own storage RLS.
