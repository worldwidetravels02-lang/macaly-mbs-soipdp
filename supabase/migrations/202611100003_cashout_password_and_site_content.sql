-- Cash-out approval debits the internal wallet exactly once, atomically.
-- Rejection leaves the wallet ledger unchanged. Marking an approved request paid
-- records the external payout confirmation only; it never debits a second time.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter extension pgcrypto set schema extensions;

create or replace function public.member_set_withdrawal_password(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_password is null or p_password !~ '^[0-9]{6,12}$' then
    raise exception 'Withdrawal password must contain 6 to 12 digits';
  end if;
  insert into public.member_security(user_id, withdrawal_password_hash, updated_at)
  values (auth.uid(), extensions.crypt(p_password, extensions.gen_salt('bf')), now())
  on conflict (user_id) do update
    set withdrawal_password_hash = excluded.withdrawal_password_hash,
        updated_at = now();
end;
$$;

create or replace function public.member_verify_withdrawal_password(p_password text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member_security
    where user_id = auth.uid()
      and withdrawal_password_hash is not null
      and withdrawal_password_hash = extensions.crypt(coalesce(p_password,''), withdrawal_password_hash)
  );
$$;

create or replace function public.member_has_withdrawal_password()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member_security
    where user_id = auth.uid() and withdrawal_password_hash is not null
  );
$$;

revoke all on function public.member_set_withdrawal_password(text) from public, anon;
revoke all on function public.member_verify_withdrawal_password(text) from public, anon;
revoke all on function public.member_has_withdrawal_password() from public, anon;
grant execute on function public.member_set_withdrawal_password(text) to authenticated;
grant execute on function public.member_verify_withdrawal_password(text) to authenticated;
grant execute on function public.member_has_withdrawal_password() to authenticated;

-- Public pages can read published text; only admins can publish changes.
create table if not exists public.site_content (
  slug text primary key check (slug in ('about','terms')),
  title text not null,
  content text not null default '',
  published boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists "Public read published site content" on public.site_content;
create policy "Public read published site content"
  on public.site_content for select to anon, authenticated
  using (published = true or (select private.is_admin()));
drop policy if exists "Admins manage site content" on public.site_content;
create policy "Admins manage site content"
  on public.site_content for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

-- Approved requests are no longer reserved: their wallet debit has been posted.
create or replace function public.enforce_withdrawal_available_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric(20,2);
  v_reserved numeric(20,2);
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;
  if (select auth.uid()) is not null
     and new.user_id <> (select auth.uid())
     and not (select private.is_admin()) then
    raise exception 'You can only request a withdrawal from your own wallet'
      using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.currency, 0));
  select coalesce(sum(case when direction = 'credit' then amount else -amount end), 0)
    into v_balance
    from public.wallet_transactions
    where user_id = new.user_id and currency = new.currency and status = 'posted';
  select coalesce(sum(amount), 0)
    into v_reserved
    from public.withdrawal_requests
    where user_id = new.user_id and currency = new.currency and status = 'pending';
  if new.amount > v_balance - v_reserved then
    raise exception 'Withdrawal amount exceeds your available balance after pending requests';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_withdrawal_available_balance() from public, anon, authenticated;
drop trigger if exists enforce_withdrawal_available_balance on public.withdrawal_requests;
create trigger enforce_withdrawal_available_balance
before insert on public.withdrawal_requests
for each row execute function public.enforce_withdrawal_available_balance();

create or replace function public.admin_review_withdrawal(
  p_request_id uuid,
  p_action text,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.withdrawal_requests%rowtype;
  v_transaction_id uuid;
  v_balance numeric(20,2);
  v_reserved numeric(20,2);
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_action not in ('approve','reject','pay') then
    raise exception 'Action must be approve, reject or pay';
  end if;
  select * into v_request
    from public.withdrawal_requests
    where id = p_request_id
    for update;
  if not found then raise exception 'Withdrawal request not found'; end if;

  if p_action = 'reject' then
    if v_request.status <> 'pending' then raise exception 'Only pending requests can be rejected'; end if;
    update public.withdrawal_requests
      set status='rejected', admin_note=p_admin_note,
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
      where id=p_request_id;
  elsif p_action = 'approve' then
    if v_request.status <> 'pending' then raise exception 'Only pending requests can be approved'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_request.user_id::text || ':' || v_request.currency, 0));
    select coalesce(sum(case when direction='credit' then amount else -amount end),0)
      into v_balance
      from public.wallet_transactions
      where user_id=v_request.user_id and currency=v_request.currency and status='posted';
    select coalesce(sum(amount),0)
      into v_reserved
      from public.withdrawal_requests
      where user_id=v_request.user_id
        and currency=v_request.currency
        and status='pending'
        and id <> v_request.id;
    if v_balance - v_reserved < v_request.amount then
      raise exception 'Insufficient available wallet balance to approve this withdrawal';
    end if;
    insert into public.wallet_transactions (
      user_id, transaction_type, direction, amount, currency, status,
      reference_type, reference_id, idempotency_key, description, created_by
    ) values (
      v_request.user_id, 'withdrawal', 'debit', v_request.amount, v_request.currency, 'posted',
      'withdrawal_request', v_request.id, 'withdrawal:' || v_request.id::text,
      'Wallet debit on administrator approval of withdrawal', auth.uid()
    )
    on conflict (idempotency_key) do nothing
    returning id into v_transaction_id;
    if v_transaction_id is null then
      raise exception 'A wallet debit already exists for this withdrawal';
    end if;
    update public.withdrawal_requests
      set status='approved', admin_note=p_admin_note,
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
      where id=p_request_id;
  else
    if v_request.status <> 'approved' then raise exception 'Only approved requests can be marked paid'; end if;
    update public.withdrawal_requests
      set status='paid', admin_note=coalesce(p_admin_note,admin_note),
          paid_at=now(), updated_at=now()
      where id=p_request_id;
  end if;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'withdrawal_' || p_action, 'withdrawal_request', v_request.id,
          jsonb_build_object('amount',v_request.amount,'currency',v_request.currency,'ledger_id',v_transaction_id));
  return v_transaction_id;
end;
$$;
revoke all on function public.admin_review_withdrawal(uuid,text,text) from public, anon;
grant execute on function public.admin_review_withdrawal(uuid,text,text) to authenticated;
