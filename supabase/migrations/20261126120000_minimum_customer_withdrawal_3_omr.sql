-- Enforce the customer-facing minimum cash-out amount for OMR withdrawals.
-- NOT VALID preserves historical rows while enforcing the rule on every new/updated row.
alter table public.withdrawal_requests
  add constraint withdrawal_requests_minimum_omr_3
  check (currency <> 'OMR' or amount >= 3)
  not valid;
