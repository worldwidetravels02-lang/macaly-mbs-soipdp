-- Allow administrators to configure any whole-number order percentages from 1% to 100% per project.
alter table public.properties
  drop constraint if exists properties_order_percentages_allowed_check;
alter table public.properties
  add constraint properties_order_percentages_allowed_check
  check (
    cardinality(order_percentages) between 1 and 20
    and 1 <= all(order_percentages)
    and 100 >= all(order_percentages)
  );

comment on column public.properties.order_percentages is
  'Administrator-configured customer order allocation buttons; each whole-number percentage must be from 1 to 100.';
