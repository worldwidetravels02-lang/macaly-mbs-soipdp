-- Admin workspace features for Msheireb Properties.
-- Run this migration in the Supabase SQL Editor before using the new admin sections.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- SECURITY DEFINER avoids recursive RLS when checking admin_members.
create or replace function public.is_msheireb_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_members
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_msheireb_admin() from public;
grant execute on function public.is_msheireb_admin() to authenticated;

drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements"
on public.announcements for all to authenticated
using (public.is_msheireb_admin())
with check (public.is_msheireb_admin());

drop policy if exists "Visitors read active announcements" on public.announcements;
create policy "Visitors read active announcements"
on public.announcements for select to anon, authenticated
using (active = true);

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
on public.profiles for select to authenticated
using (public.is_msheireb_admin());

drop policy if exists "Admins read all support threads" on public.support_threads;
create policy "Admins read all support threads"
on public.support_threads for select to authenticated
using (public.is_msheireb_admin());

drop policy if exists "Admins read all support messages" on public.support_messages;
create policy "Admins read all support messages"
on public.support_messages for select to authenticated
using (public.is_msheireb_admin());

drop policy if exists "Admins send support messages" on public.support_messages;
create policy "Admins send support messages"
on public.support_messages for insert to authenticated
with check (
  public.is_msheireb_admin()
  and sender_id = (select auth.uid())
);

drop policy if exists "Admins create member notifications" on public.notifications;
create policy "Admins create member notifications"
on public.notifications for insert to authenticated
with check (public.is_msheireb_admin());

drop policy if exists "Admins read notifications" on public.notifications;
create policy "Admins read notifications"
on public.notifications for select to authenticated
using (public.is_msheireb_admin());

create index if not exists announcements_active_created_idx
on public.announcements (active, created_at desc);

create index if not exists support_threads_updated_idx
on public.support_threads (updated_at desc);

create index if not exists support_messages_thread_created_idx
on public.support_messages (thread_id, created_at);
