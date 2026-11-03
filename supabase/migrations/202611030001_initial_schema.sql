-- Msheireb Properties: initial Supabase foundation
-- Apply this migration in Supabase SQL Editor after reviewing it.
-- No financial/investment-return tables are created in this initial phase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  mobile text,
  preferred_language text not null default 'en' check (preferred_language in ('en','ar')),
  preferred_currency text not null default 'AED' check (preferred_currency in ('AED','OMR','SAR','KWD','BHD','QAR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_members
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  location text,
  description text,
  price_label text not null default 'Price on request',
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  mobile text not null,
  property_id uuid references public.properties(id) on delete set null,
  message text,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists enquiries_created_at_idx on public.enquiries(created_at desc);
create index if not exists enquiries_status_idx on public.enquiries(status);
create index if not exists properties_status_idx on public.properties(status);
create index if not exists support_threads_user_id_idx on public.support_threads(user_id);
create index if not exists support_messages_thread_id_idx on public.support_messages(thread_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.admin_members enable row level security;
alter table public.properties enable row level security;
alter table public.enquiries enable row level security;
alter table public.promotions enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.notifications enable row level security;

create policy "Users can read own profile or admins can read all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Users can create own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "Users can update own profile or admins can update all"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy "Admins can read admin members"
on public.admin_members for select to authenticated
using ((select private.is_admin()));

create policy "Published properties are public"
on public.properties for select to anon, authenticated
using (status = 'published' or (select private.is_admin()));

create policy "Admins manage properties"
on public.properties for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Visitors can submit enquiries"
on public.enquiries for insert to anon, authenticated
with check (true);

create policy "Admins manage enquiries"
on public.enquiries for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Active promotions are public"
on public.promotions for select to anon, authenticated
using ((active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())) or (select private.is_admin()));

create policy "Admins manage promotions"
on public.promotions for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Members read own support threads"
on public.support_threads for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Members create own support threads"
on public.support_threads for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Members update own thread or admins update any"
on public.support_threads for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Thread participants read messages"
on public.support_messages for select to authenticated
using (
  sender_id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1 from public.support_threads t
    where t.id = thread_id and t.user_id = (select auth.uid())
  )
);

create policy "Members send messages in own threads"
on public.support_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.support_threads t
    where t.id = thread_id and t.user_id = (select auth.uid())
  )
);

create policy "Admins can send support replies"
on public.support_messages for insert to authenticated
with check (sender_id = (select auth.uid()) and (select private.is_admin()));

create policy "Users read own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Users mark own notifications read"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

-- Profile row is created automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
