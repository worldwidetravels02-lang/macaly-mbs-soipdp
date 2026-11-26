-- Project catalogue prices are maintained directly in OMR.
-- The order RPC already reserves and funds project orders in OMR; align the
-- schema metadata so administrators and future tooling do not treat prices as AED.
comment on column public.properties.price_amount is
  'Administrator-set base project price in OMR for catalogue order calculations.';
