-- ============================================================
-- Warehouse Tracker - Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- ============================================================

-- ----------- PROFILES (one row per user) --------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Automatically create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------- PROJECTS ---------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      text not null default 'active',  -- active | completed | on_hold
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- ----------- INBOUND RECORDS --------------------------------
create table if not exists public.inbound_records (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  reference_no  text,
  carrier       text,
  description   text,
  quantity      integer,
  status        text not null default 'pending',  -- pending | received | discrepancy
  received_at   timestamptz,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- ----------- OUTBOUND RECORDS -------------------------------
create table if not exists public.outbound_records (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  reference_no  text,
  carrier       text,
  destination   text,
  description   text,
  quantity      integer,
  status        text not null default 'pending',  -- pending | shipped | cancelled
  shipped_at    timestamptz,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- ----------- ATTACHMENTS (paperwork) ------------------------
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  record_type  text not null,   -- 'inbound' | 'outbound'
  record_id    uuid not null,
  file_path    text not null,   -- path within the 'paperwork' storage bucket
  file_name    text not null,
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index if not exists attachments_record_idx
  on public.attachments (record_type, record_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Shared warehouse: any authenticated user can read/write all
-- records. Adjust later if you need per-user restrictions.
-- ============================================================
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.inbound_records  enable row level security;
alter table public.outbound_records enable row level security;
alter table public.attachments      enable row level security;

-- PROFILES: everyone authenticated can read; you can only edit your own.
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_read"   on public.profiles for select to authenticated using (true);
create policy "profiles_update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Helper macro pattern for the shared tables: authenticated full access.
drop policy if exists "projects_all" on public.projects;
create policy "projects_all" on public.projects
  for all to authenticated using (true) with check (true);

drop policy if exists "inbound_all" on public.inbound_records;
create policy "inbound_all" on public.inbound_records
  for all to authenticated using (true) with check (true);

drop policy if exists "outbound_all" on public.outbound_records;
create policy "outbound_all" on public.outbound_records
  for all to authenticated using (true) with check (true);

drop policy if exists "attachments_all" on public.attachments;
create policy "attachments_all" on public.attachments
  for all to authenticated using (true) with check (true);

-- ============================================================
-- STORAGE BUCKET for paperwork
-- ============================================================
insert into storage.buckets (id, name, public)
values ('paperwork', 'paperwork', false)
on conflict (id) do nothing;

-- Storage policies: authenticated users can manage files in 'paperwork'.
drop policy if exists "paperwork_read"   on storage.objects;
drop policy if exists "paperwork_insert" on storage.objects;
drop policy if exists "paperwork_update" on storage.objects;
drop policy if exists "paperwork_delete" on storage.objects;

create policy "paperwork_read" on storage.objects
  for select to authenticated using (bucket_id = 'paperwork');
create policy "paperwork_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'paperwork');
create policy "paperwork_update" on storage.objects
  for update to authenticated using (bucket_id = 'paperwork');
create policy "paperwork_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'paperwork');
