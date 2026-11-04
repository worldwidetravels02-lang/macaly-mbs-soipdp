-- Review crypto wallet top-ups atomically with their wallet ledger credit.
create or replace function public.admin_review_crypto_payment(
  p_payment_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.crypto_payments%rowtype;
  v_transaction_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into v_payment from public.crypto_payments where id = p_payment_id for update;
  if not found then raise exception 'Crypto payment submission not found'; end if;
  if v_payment.status <> 'pending' then raise exception 'Crypto payment has already been reviewed'; end if;
  if p_approve and v_payment.kind <> 'topup' then
    raise exception 'Only wallet top-up crypto submissions can be credited. Deposit and investment workflows must be handled separately.';
  end if;

  update public.crypto_payments
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_note = p_admin_note,
      reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = p_payment_id;

  if p_approve then
    insert into public.wallet_transactions (
      user_id, transaction_type, direction, amount, currency, status,
      reference_type, reference_id, idempotency_key, description, created_by,
      metadata
    ) values (
      v_payment.user_id, 'deposit', 'credit', v_payment.amount, v_payment.currency, 'posted',
      'crypto_payment', v_payment.id, 'crypto:' || v_payment.id::text,
      'Crypto wallet top-up approved · ' || v_payment.coin || ' / ' || v_payment.network,
      (select auth.uid()), jsonb_build_object('coin', v_payment.coin, 'network', v_payment.network, 'transaction_hash', v_payment.transaction_hash)
    ) returning id into v_transaction_id;
  end if;

  insert into public.financial_audit_log(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_approve then 'crypto_payment_approved' else 'crypto_payment_rejected' end,
          'crypto_payment', v_payment.id,
          jsonb_build_object('amount', v_payment.amount, 'currency', v_payment.currency, 'ledger_id', v_transaction_id));
  return v_transaction_id;
end;
$$;

revoke all on function public.admin_review_crypto_payment(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_crypto_payment(uuid, boolean, text) to authenticated;
