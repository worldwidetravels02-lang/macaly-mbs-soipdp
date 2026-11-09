-- Admin-controlled project prices and customer order allocation choices.
alter table public.properties
  add column if not exists price_amount numeric(20,2),
  add column if not exists order_percentages smallint[] not null default array[10,25,50,75,100]::smallint[];

alter table public.properties
  drop constraint if exists properties_price_amount_positive_check;
alter table public.properties
  add constraint properties_price_amount_positive_check
  check (price_amount is null or price_amount > 0);

alter table public.properties
  drop constraint if exists properties_order_percentages_allowed_check;
alter table public.properties
  add constraint properties_order_percentages_allowed_check
  check (
    cardinality(order_percentages) between 1 and 5
    and order_percentages <@ array[10,25,50,75,100]::smallint[]
  );

comment on column public.properties.price_amount is
  'Administrator-set base project price in AED for catalogue order calculations.';
comment on column public.properties.order_percentages is
  'Administrator-enabled customer order allocation buttons, chosen from 10, 25, 50, 75 and 100 percent.';
