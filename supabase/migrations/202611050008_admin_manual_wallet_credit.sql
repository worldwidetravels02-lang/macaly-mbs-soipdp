-- Allow administrators to manually add funds to a customer's internal wallet.
-- Customer sessions cannot call this function successfully.
create or replace function public.admin_add_wallet_balance(
  p_user_id uuid,
  p_amount numeric,
  p_currency text default 'AED',
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_description text;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Select a valid customer';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Amount must be greater than zero and no more than 100,000,000';
  end if;
  if p_currency not in ('AED','OMR','SAR','KWD','BHD','QAR') then
    raise exception 'Unsupported currency';
  end if;

  v_description := coalesce(nullif(btrim(p_description), ''), 'Wallet balance added by administrator');
  if length(v_description) > 240 then
    raise exception 'Description must be 240 characters or fewer';
  end if;

  insert into public.wallet_transactions (
    user_id, transaction_type, direction, amount, currency, status,
    reference_type, idempotency_key, description, created_by, metadata
  ) values (
    p_user_id, 'admin_credit', 'credit', p_amount, p_currency, 'posted',
    'admin_manual_credit', 'admin-credit:' || gen_random_uuid()::text,
    v_description, (select auth.uid()), jsonb_build_object('source', 'admin_manual_credit')
  )
  returning id into v_transaction_id;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()), 'admin_wallet_balance_added', 'wallet_transaction', v_transaction_id,
    jsonb_build_object('customer_id', p_user_id, 'amount', p_amount, 'currency', p_currency, 'description', v_description)
  );

  return v_transaction_id;
end;
$$;

revoke all on function public.admin_add_wallet_balance(uuid, numeric, text, text) from public, anon;
grant execute on function public.admin_add_wallet_balance(uuid, numeric, text, text) to authenticated;
