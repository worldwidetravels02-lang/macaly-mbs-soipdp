-- Add INR to the administrator-managed exchange-rate table.
-- This is an initial fallback rate; the owner can update it in Admin > Settings.
insert into public.fx_rates (code, label, aed_per_unit)
values ('INR', 'Indian rupee', 0.0441)
on conflict (code) do nothing;
