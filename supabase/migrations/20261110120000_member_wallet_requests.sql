-- Member wallet requests for Msheireb Properties.
-- Balances are changed only by the administrator approval function.
create table if not exists public.member_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  hold_balance numeric(14,2) not null default 0 check (hold_balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('deposit','withdrawal')),
  amount numeric(14,2) not null check (amount > 0),
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wallet_requests_user_created_idx
  on public.wallet_requests(user_id, created_at desc);
create index if not exists wallet_requests_status_created_idx
  on public.wallet_requests(status, created_at desc);

alter table public.member_wallets enable row level security;
alter table public.wallet_requests enable row level security;

drop policy if exists "Members read own wallet" on public.member_wallets;
create policy "Members read own wallet"
on public.member_wallets for select to authenticated
using (user_id = (select auth.uid()) or public.is_msheireb_admin());

drop policy if exists "Admins manage member wallets" on public.member_wallets;
create policy "Admins manage member wallets"
on public.member_wallets for all to authenticated
using (public.is_msheireb_admin())
with check (public.is_msheireb_admin());

drop policy if exists "Members read own wallet requests" on public.wallet_requests;
create policy "Members read own wallet requests"
on public.wallet_requests for select to authenticated
using (user_id = (select auth.uid()) or public.is_msheireb_admin());

drop policy if exists "Members create own pending wallet requests" on public.wallet_requests;
create policy "Members create own pending wallet requests"
on public.wallet_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "Admins review wallet requests" on public.wallet_requests;
create policy "Admins review wallet requests"
on public.wallet_requests for update to authenticated
using (public.is_msheireb_admin())
with check (public.is_msheireb_admin());

create or replace function public.create_member_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_wallets(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_wallet_created on auth.users;
create trigger on_auth_user_wallet_created
after insert on auth.users
for each row execute procedure public.create_member_wallet();

insert into public.member_wallets(user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.review_wallet_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.wallet_requests%rowtype;
begin
  if not public.is_msheireb_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into v_request
  from public.wallet_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Wallet request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  insert into public.member_wallets(user_id)
  values (v_request.user_id)
  on conflict (user_id) do nothing;

  if p_decision = 'approved' then
    if v_request.request_type = 'deposit' then
      update public.member_wallets
      set balance = balance + v_request.amount, updated_at = now()
      where user_id = v_request.user_id;
    else
      update public.member_wallets
      set balance = balance - v_request.amount, updated_at = now()
      where user_id = v_request.user_id and balance >= v_request.amount;
      if not found then raise exception 'Insufficient wallet balance for this withdrawal'; end if;
    end if;
  end if;

  update public.wallet_requests
  set status = p_decision,
      admin_note = nullif(trim(coalesce(p_admin_note,'')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.review_wallet_request(uuid,text,text) from public, anon;
grant execute on function public.review_wallet_request(uuid,text,text) to authenticated;
