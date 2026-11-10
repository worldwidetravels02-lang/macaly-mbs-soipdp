-- Make OMR the default preferred currency for new and existing profiles.
-- Existing wallet ledger amounts are not converted or moved; each currency remains separate.
alter table public.profiles
  alter column preferred_currency set default 'OMR';

update public.profiles
set preferred_currency = 'OMR', updated_at = now()
where preferred_currency is null or preferred_currency = 'AED';
