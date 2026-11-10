-- Align wallet hold currency validation with the admin wallet currency selector.
alter table public.wallet_holds drop constraint if exists wallet_holds_currency_check;
alter table public.wallet_holds add constraint wallet_holds_currency_check
  check (currency in ('AED','OMR','SAR','KWD','BHD','QAR','PKR','BDT'));

create or replace function public.admin_hold_wallet_balance(
  p_user_id uuid, p_amount numeric, p_currency text, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_balance numeric(20,2);
  v_held numeric(20,2);
  v_pending numeric(20,2);
  v_id uuid;
begin
  if not (select private.is_admin()) then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'Enter a valid hold amount'; end if;
  if p_currency not in ('AED','OMR','SAR','KWD','BHD','QAR','PKR','BDT') then raise exception 'Unsupported currency'; end if;
  if p_reason is null or char_length(trim(p_reason)) not between 1 and 240 then raise exception 'A reason of 1 to 240 characters is required'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Customer not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_currency,0));
  select coalesce(sum(case when direction='credit' then amount else -amount end),0)
    into v_balance from public.wallet_transactions
    where user_id=p_user_id and currency=p_currency and status='posted';
  select coalesce(sum(amount-released_amount),0) into v_held
    from public.wallet_holds where user_id=p_user_id and currency=p_currency and status='active';
  select coalesce(sum(amount),0) into v_pending
    from public.withdrawal_requests where user_id=p_user_id and currency=p_currency and status='pending';
  if p_amount > v_balance-v_held-v_pending then
    raise exception 'Hold amount exceeds the customer available wallet balance';
  end if;
  insert into public.wallet_holds(user_id,currency,amount,reason,created_by)
    values(p_user_id,p_currency,p_amount,trim(p_reason),(select auth.uid())) returning id into v_id;
  insert into public.financial_audit_log(actor_id,action,entity_type,entity_id,details)
    values((select auth.uid()),'wallet_amount_held','wallet_hold',v_id,
      jsonb_build_object('customer_id',p_user_id,'amount',p_amount,'currency',p_currency,'reason',trim(p_reason)));
  return v_id;
end; $$;

create or replace function public.admin_release_wallet_hold(
  p_hold_id uuid, p_amount numeric default null
) returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_hold public.wallet_holds%rowtype;
  v_remaining numeric(20,2);
  v_release numeric(20,2);
begin
  if not (select private.is_admin()) then raise exception 'Administrator access required' using errcode='42501'; end if;
  select * into v_hold from public.wallet_holds where id=p_hold_id for update;
  if not found then raise exception 'Wallet hold not found'; end if;
  v_remaining := v_hold.amount-v_hold.released_amount;
  if v_hold.status <> 'active' or v_remaining <= 0 then raise exception 'This hold has already been fully released'; end if;
  v_release := coalesce(p_amount,v_remaining);
  if v_release <= 0 or v_release > v_remaining then raise exception 'Release amount must be greater than zero and no more than the remaining held amount'; end if;
  update public.wallet_holds set released_amount=released_amount+v_release,
    status=case when released_amount+v_release >= amount then 'released' else 'active' end,
    released_by=(select auth.uid()), released_at=case when released_amount+v_release >= amount then now() else released_at end,
    updated_at=now() where id=p_hold_id;
  insert into public.financial_audit_log(actor_id,action,entity_type,entity_id,details)
    values((select auth.uid()),'wallet_hold_released','wallet_hold',p_hold_id,
      jsonb_build_object('customer_id',v_hold.user_id,'released_amount',v_release,'currency',v_hold.currency,'remaining_amount',v_remaining-v_release));
  return v_remaining-v_release;
end; $$;

-- Include active holds when checking customer withdrawal requests.
create or replace function public.enforce_withdrawal_available_balance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_balance numeric(20,2);
  v_reserved numeric(20,2);
  v_held numeric(20,2);
begin
  if new.amount is null or new.amount <= 0 then raise exception 'Withdrawal amount must be greater than zero'; end if;
  if (select auth.uid()) is not null and new.user_id <> (select auth.uid()) and not (select private.is_admin()) then
    raise exception 'You can only request a withdrawal from your own wallet' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.currency,0));
  select coalesce(sum(case when direction='credit' then amount else -amount end),0) into v_balance
    from public.wallet_transactions where user_id=new.user_id and currency=new.currency and status='posted';
  select coalesce(sum(amount),0) into v_reserved from public.withdrawal_requests
    where user_id=new.user_id and currency=new.currency and status='pending';
  select coalesce(sum(amount-released_amount),0) into v_held from public.wallet_holds
    where user_id=new.user_id and currency=new.currency and status='active';
  if new.amount > v_balance-v_reserved-v_held then
    raise exception 'Withdrawal amount exceeds your available balance after pending withdrawals and wallet holds';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_withdrawal_available_balance() from public, anon, authenticated;
drop trigger if exists enforce_withdrawal_available_balance on public.withdrawal_requests;
create trigger enforce_withdrawal_available_balance before insert on public.withdrawal_requests
for each row execute function public.enforce_withdrawal_available_balance();

-- Approval must also respect any holds that were placed after a withdrawal request was submitted.
create or replace function public.admin_review_withdrawal(
  p_request_id uuid, p_action text, p_admin_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.withdrawal_requests%rowtype;
  v_transaction_id uuid;
  v_balance numeric(20,2);
  v_reserved numeric(20,2);
  v_held numeric(20,2);
begin
  if not (select private.is_admin()) then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_action not in ('approve','reject','pay') then raise exception 'Action must be approve, reject or pay'; end if;
  select * into v_request from public.withdrawal_requests where id=p_request_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if p_action='reject' then
    if v_request.status <> 'pending' then raise exception 'Only pending requests can be rejected'; end if;
    update public.withdrawal_requests set status='rejected',admin_note=p_admin_note,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=p_request_id;
  elsif p_action='approve' then
    if v_request.status <> 'pending' then raise exception 'Only pending requests can be approved'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_request.user_id::text || ':' || v_request.currency,0));
    select coalesce(sum(case when direction='credit' then amount else -amount end),0) into v_balance
      from public.wallet_transactions where user_id=v_request.user_id and currency=v_request.currency and status='posted';
    select coalesce(sum(amount),0) into v_reserved from public.withdrawal_requests
      where user_id=v_request.user_id and currency=v_request.currency and status='pending' and id<>v_request.id;
    select coalesce(sum(amount-released_amount),0) into v_held from public.wallet_holds
      where user_id=v_request.user_id and currency=v_request.currency and status='active';
    if v_balance-v_reserved-v_held < v_request.amount then raise exception 'Insufficient available wallet balance after wallet holds'; end if;
    insert into public.wallet_transactions(user_id,transaction_type,direction,amount,currency,status,reference_type,reference_id,idempotency_key,description,created_by)
      values(v_request.user_id,'withdrawal','debit',v_request.amount,v_request.currency,'posted','withdrawal_request',v_request.id,
        'withdrawal:'||v_request.id::text,'Wallet debit on administrator approval of withdrawal',(select auth.uid()))
      on conflict(idempotency_key) do nothing returning id into v_transaction_id;
    if v_transaction_id is null then raise exception 'A wallet debit already exists for this withdrawal'; end if;
    update public.withdrawal_requests set status='approved',admin_note=p_admin_note,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=p_request_id;
  else
    if v_request.status <> 'approved' then raise exception 'Only approved requests can be marked paid'; end if;
    update public.withdrawal_requests set status='paid',admin_note=coalesce(p_admin_note,admin_note),paid_at=now(),updated_at=now() where id=p_request_id;
  end if;
  insert into public.financial_audit_log(actor_id,action,entity_type,entity_id,details)
    values((select auth.uid()),'withdrawal_'||p_action,'withdrawal_request',v_request.id,
      jsonb_build_object('amount',v_request.amount,'currency',v_request.currency,'ledger_id',v_transaction_id));
  return v_transaction_id;
end; $$;


revoke all on function public.admin_hold_wallet_balance(uuid,numeric,text,text) from public, anon;
grant execute on function public.admin_hold_wallet_balance(uuid,numeric,text,text) to authenticated;
