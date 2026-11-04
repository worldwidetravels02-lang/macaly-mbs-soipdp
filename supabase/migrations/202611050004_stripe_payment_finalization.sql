-- Finalize signed Stripe checkout events in one database transaction.
-- Only the service role (used by the verified Stripe webhook) may execute this function.
create or replace function public.finalize_stripe_payment(
  p_session_id text,
  p_paid boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_name text;
begin
  select * into v_payment
  from public.payments
  where provider_session_id = p_session_id
  for update;

  if not found then
    raise exception 'Payment session not found';
  end if;

  if v_payment.status = 'paid' then
    return v_payment.id;
  end if;

  if v_payment.status <> 'pending' then
    return v_payment.id;
  end if;

  if not p_paid then
    update public.payments set status = 'expired' where id = v_payment.id;
    return v_payment.id;
  end if;

  update public.payments
  set status = 'paid', paid_at = now()
  where id = v_payment.id;

  if v_payment.kind = 'topup' then
    insert into public.wallet_transactions (
      user_id, transaction_type, direction, amount, currency, status,
      reference_type, reference_id, idempotency_key, description
    ) values (
      v_payment.user_id, 'deposit', 'credit', v_payment.amount, 'AED', 'posted',
      'stripe_payment', v_payment.id, 'stripe-payment:' || v_payment.id::text,
      'Stripe card top-up'
    )
    on conflict (idempotency_key) do nothing;
  else
    insert into public.reservation_deposits (
      user_id, property_id, property_name, amount, amount_charged,
      currency, payment_id, mode
    ) values (
      v_payment.user_id, v_payment.property_id,
      coalesce((select name from public.properties where id = v_payment.property_id), 'Residence'),
      v_payment.amount, v_payment.amount_charged, v_payment.currency,
      v_payment.id, v_payment.mode
    )
    on conflict (payment_id) do nothing;
  end if;

  select coalesce(full_name, 'Customer') into v_name
  from public.profiles where id = v_payment.user_id;

  insert into public.notifications (user_id, title, body)
  values (
    v_payment.user_id,
    case when v_payment.kind = 'topup' then 'Card top-up received' else 'Reservation deposit received' end,
    coalesce(v_name, 'Customer') || ' payment confirmed: ' ||
      v_payment.currency || ' ' || v_payment.amount_charged::text
  );

  return v_payment.id;
end;
$$;

revoke all on function public.finalize_stripe_payment(text, boolean) from public, anon, authenticated;
grant execute on function public.finalize_stripe_payment(text, boolean) to service_role;
