-- Tape — database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) once per project.
--
-- Security posture: trusted family group. The browser uses the anon key with
-- permissive RLS for reads/writes. The one secret — pin_hash — is NEVER exposed
-- to the browser: anon has column-level SELECT on users EXCEPT pin_hash, and the
-- PIN is verified server-side by the `verify-pin` Edge Function (service role).

-- Needed for crypt()/gen_salt() used by the Edge Function's bcrypt verification.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  color    text not null default '#4f8cff',
  pin_hash text not null
);

create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  date       date not null default current_date,
  note       text,
  -- All measurements nullable — an entry may carry any subset.
  weight     numeric,
  chest      numeric,
  waist      numeric,
  hips       numeric,
  arm        numeric,
  thigh      numeric,
  created_at timestamptz not null default now()
);

create index if not exists entries_user_date_idx on public.entries (user_id, date);
create index if not exists entries_created_idx on public.entries (created_at desc);

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.entries (id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create index if not exists photos_entry_idx on public.photos (entry_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users   enable row level security;
alter table public.entries enable row level security;
alter table public.photos  enable row level security;

-- Users: browser may read the roster (name/color) but not pin_hash. Column-level
-- grants below enforce the pin_hash exclusion; the RLS policy allows the rows.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to anon, authenticated using (true);

-- Entries & photos: open CRUD for the trusted group via the anon key.
drop policy if exists entries_all on public.entries;
create policy entries_all on public.entries for all to anon, authenticated using (true) with check (true);

drop policy if exists photos_all on public.photos;
create policy photos_all on public.photos for all to anon, authenticated using (true) with check (true);

-- Column-level privileges: hide pin_hash from the browser roles.
revoke all on public.users from anon, authenticated;
grant select (id, name, color) on public.users to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PIN verification helper (called by the verify-pin Edge Function only)
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so it can read pin_hash regardless of the caller's grants.
-- Execute is restricted to service_role so the browser can't call it to brute-force.
create or replace function public.verify_user_pin(p_user_id uuid, p_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.users
    where id = p_user_id
      and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

revoke all on function public.verify_user_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_user_pin(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket for progress photos (public read)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Allow the anon role to upload into the photos bucket.
drop policy if exists photos_upload on storage.objects;
create policy photos_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos');

drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'photos');
