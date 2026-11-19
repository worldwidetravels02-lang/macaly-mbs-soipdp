-- Admin-assigned, one-time Fortune Box promotional credits.
-- Rewards are recorded separately from the withdrawable wallet ledger.

create table if not exists public.fortune_box_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_name text not null check (level_name in ('Senior','Master','Expert')),
  badge_number smallint not null check (badge_number between 1 and 3),
  position smallint not null check (position between 1 and 20),
  rewards jsonb not null,
  status text not null default 'active' check (status in ('active','claimed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (user_id, level_name, badge_number, position),
  constraint fortune_box_rewards_are_three_cards check (
    jsonb_typeof(rewards) = 'array' and jsonb_array_length(rewards) = 3
  )
);

create table if not exists public.fortune_reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  assignment_id uuid not null unique references public.fortune_box_assignments(id) on delete restrict,
  card_number smallint not null check (card_number between 1 and 3),
  amount numeric(20,2) not null check (amount >= 0),
  currency text not null default 'OMR' check (currency = 'OMR'),
  description text not null default 'Fortune Box promotional reward',
  created_at timestamptz not null default now()
);

create index if not exists fortune_box_assignments_user_position_idx
  on public.fortune_box_assignments(user_id, level_name, badge_number, position);
create index if not exists fortune_reward_transactions_user_created_idx
  on public.fortune_reward_transactions(user_id, created_at desc);

alter table public.fortune_box_assignments enable row level security;
alter table public.fortune_reward_transactions enable row level security;
revoke all on public.fortune_box_assignments, public.fortune_reward_transactions from anon, authenticated;
grant select, insert, update, delete on public.fortune_box_assignments to authenticated;
grant select on public.fortune_reward_transactions to authenticated;

drop policy if exists "Customers read own Fortune Box assignments" on public.fortune_box_assignments;
create policy "Customers read own Fortune Box assignments"
  on public.fortune_box_assignments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Admins manage Fortune Box assignments" on public.fortune_box_assignments;
create policy "Admins manage Fortune Box assignments"
  on public.fortune_box_assignments for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Customers read own Fortune Box rewards" on public.fortune_reward_transactions;
create policy "Customers read own Fortune Box rewards"
  on public.fortune_reward_transactions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop function if exists public.claim_fortune_box(uuid, smallint);

create function public.claim_fortune_box(
  p_assignment_id uuid,
  p_card_number smallint
)
returns table(id uuid, amount numeric, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_assignment public.fortune_box_assignments%rowtype;
  v_reward jsonb;
  v_amount numeric(20,2);
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_card_number is null or p_card_number not between 1 and 3 then
    raise exception 'Choose one of the three cards';
  end if;

  select * into v_assignment
  from public.fortune_box_assignments
  where fortune_box_assignments.id = p_assignment_id
    and fortune_box_assignments.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Fortune Box assignment not found';
  end if;
  if v_assignment.status <> 'active' then
    raise exception 'This Fortune Box assignment has already been claimed or cancelled';
  end if;

  v_reward := v_assignment.rewards -> (p_card_number - 1);
  if jsonb_typeof(v_reward) <> 'object' then
    raise exception 'The selected reward is not configured';
  end if;
  v_amount := (v_reward ->> 'amount')::numeric;
  if v_amount is null or v_amount < 0 or v_amount > 100000 then
    raise exception 'The selected reward amount is invalid';
  end if;

  insert into public.fortune_reward_transactions(
    user_id, assignment_id, card_number, amount, currency, description
  ) values (
    v_user_id, v_assignment.id, p_card_number, v_amount, 'OMR',
    'Fortune Box promotional reward credit'
  ) returning fortune_reward_transactions.id into v_transaction_id;

  update public.fortune_box_assignments
  set status = 'claimed', claimed_at = now()
  where fortune_box_assignments.id = v_assignment.id;

  return query select v_transaction_id, v_amount, 'OMR'::text;
end;
$$;

revoke all on function public.claim_fortune_box(uuid,smallint) from public, anon;
grant execute on function public.claim_fortune_box(uuid,smallint) to authenticated;

comment on table public.fortune_reward_transactions is
  'Promotional reward records only; these amounts are not withdrawable and never enter the cash wallet ledger.';
