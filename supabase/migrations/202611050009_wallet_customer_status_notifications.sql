-- Notify customers when an administrator changes their deposit or withdrawal request status.
-- Trigger-based so notifications are created atomically with the admin review transaction.

create or replace function public.notify_wallet_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_kind text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if tg_table_name = 'topup_requests' then
    v_kind := 'deposit';
    v_title := case new.status
      when 'approved' then 'Deposit request approved'
      when 'rejected' then 'Deposit request rejected'
      else 'Deposit request updated'
    end;
    v_body := 'Your deposit request for ' || new.currency || ' ' ||
      to_char(new.amount, 'FM999,999,999,990.00') || ' is now ' ||
      replace(new.status, '_', ' ') || '.';
  else
    v_kind := 'withdrawal';
    v_title := case new.status
      when 'approved' then 'Withdrawal request approved'
      when 'rejected' then 'Withdrawal request rejected'
      when 'paid' then 'Withdrawal marked as paid'
      else 'Withdrawal request updated'
    end;
    v_body := 'Your withdrawal request for ' || new.currency || ' ' ||
      to_char(new.amount, 'FM999,999,999,990.00') || ' is now ' ||
      replace(new.status, '_', ' ') || '.';
  end if;

  if nullif(btrim(new.admin_note), '') is not null then
    v_body := v_body || ' Admin note: ' || left(btrim(new.admin_note), 500);
  end if;

  insert into public.notifications (user_id, title, body)
  values (new.user_id, v_title, v_body);

  return new;
end;
$$;

revoke all on function public.notify_wallet_request_status_change() from public, anon, authenticated;

drop trigger if exists topup_request_customer_status_notification on public.topup_requests;
create trigger topup_request_customer_status_notification
after update of status on public.topup_requests
for each row execute function public.notify_wallet_request_status_change();

drop trigger if exists withdrawal_request_customer_status_notification on public.withdrawal_requests;
create trigger withdrawal_request_customer_status_notification
after update of status on public.withdrawal_requests
for each row execute function public.notify_wallet_request_status_change();
