-- Customer account bank details and secure withdrawal-password support.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.member_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_holder text not null check (length(trim(account_holder)) between 2 and 120),
  bank_name text not null check (length(trim(bank_name)) between 2 and 120),
  iban text not null default '',
  account_number text not null,
  mobile_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_bank_accounts_user_idx on public.member_bank_accounts(user_id, created_at desc);
alter table public.member_bank_accounts enable row level security;
drop policy if exists "Members read own bank accounts" on public.member_bank_accounts;
create policy "Members read own bank accounts" on public.member_bank_accounts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Members add own bank accounts" on public.member_bank_accounts;
create policy "Members add own bank accounts" on public.member_bank_accounts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Members update own bank accounts" on public.member_bank_accounts;
create policy "Members update own bank accounts" on public.member_bank_accounts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Members delete own bank accounts" on public.member_bank_accounts;
create policy "Members delete own bank accounts" on public.member_bank_accounts for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.member_bank_accounts to authenticated;

create table if not exists public.member_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  withdrawal_password_hash text,
  updated_at timestamptz not null default now()
);
alter table public.member_security enable row level security;
revoke all on public.member_security from anon, authenticated;

create or replace function public.member_set_withdrawal_password(p_password text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_password is null or p_password !~ '^[0-9]{6,12}$' then
    raise exception 'Withdrawal password must contain 6 to 12 digits';
  end if;
  insert into public.member_security(user_id, withdrawal_password_hash, updated_at)
  values (auth.uid(), extensions.crypt(p_password, extensions.gen_salt('bf')), now())
  on conflict (user_id) do update set withdrawal_password_hash=excluded.withdrawal_password_hash, updated_at=now();
end;
$$;

create or replace function public.member_verify_withdrawal_password(p_password text)
returns boolean language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member_security
    where user_id = auth.uid()
      and withdrawal_password_hash = extensions.crypt(coalesce(p_password,''), withdrawal_password_hash)
  );
$$;

create or replace function public.member_has_withdrawal_password()
returns boolean language sql security definer set search_path = ''
as $$
  select exists (select 1 from public.member_security where user_id = auth.uid() and withdrawal_password_hash is not null);
$$;

revoke all on function public.member_set_withdrawal_password(text) from public, anon;
revoke all on function public.member_verify_withdrawal_password(text) from public, anon;
revoke all on function public.member_has_withdrawal_password() from public, anon;
grant execute on function public.member_set_withdrawal_password(text) to authenticated;
grant execute on function public.member_verify_withdrawal_password(text) to authenticated;
grant execute on function public.member_has_withdrawal_password() to authenticated;
