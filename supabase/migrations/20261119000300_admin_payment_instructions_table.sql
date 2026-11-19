-- Administrator-managed reference instructions for manual bank deposits.
-- This table does not initiate payments or credit customer wallets.

create table if not exists public.payment_details (
  id text primary key default 'default' check (id = 'default'),
  bank_name text not null default '' check (char_length(bank_name) <= 120),
  account_name text not null default '' check (char_length(account_name) <= 160),
  account_number text not null default '' check (char_length(account_number) <= 64),
  iban text not null default '' check (char_length(iban) <= 64),
  swift text not null default '' check (char_length(swift) <= 24),
  note text not null default '' check (char_length(note) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.payment_details enable row level security;
revoke all on public.payment_details from anon, authenticated;
grant select, insert, update on public.payment_details to authenticated;

drop policy if exists "Admins manage payment instructions" on public.payment_details;
create policy "Admins manage payment instructions"
  on public.payment_details for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
