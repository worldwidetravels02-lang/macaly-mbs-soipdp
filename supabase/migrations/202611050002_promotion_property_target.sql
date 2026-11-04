-- Allow administrators to target a promotion to one property slug.
-- NULL means the promotion is global across the public residence pages.
alter table public.promotions
  add column if not exists property_slug text;

create index if not exists promotions_property_slug_active_idx
  on public.promotions (property_slug, active);
