create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'News',
  excerpt text not null default '',
  content text not null default '',
  cover_image_url text,
  author_name text not null default 'Msheireb Properties',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists posts_published_created_idx
  on public.posts (published, published_at desc);

alter table public.posts enable row level security;

drop policy if exists "Anyone can read published posts" on public.posts;
create policy "Anyone can read published posts"
  on public.posts for select to anon, authenticated
  using (published = true or (select private.is_admin()));

drop policy if exists "Admins manage posts" on public.posts;
create policy "Admins manage posts"
  on public.posts for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
