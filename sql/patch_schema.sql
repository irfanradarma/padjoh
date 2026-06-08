-- ============================================================
--  Patch: notes, exercises, activities, assignments + storage
--  Run once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Helper: is current user admin?
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Notes (one row per user per section, upserted on save)
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  section_id integer not null check (section_id between 1 and 16),
  content    text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id, section_id)
);
alter table public.notes enable row level security;

drop policy if exists notes_select  on public.notes;
drop policy if exists notes_insert  on public.notes;
drop policy if exists notes_update  on public.notes;

create policy notes_select on public.notes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy notes_insert on public.notes for insert to authenticated
  with check (user_id = auth.uid());
create policy notes_update on public.notes for update to authenticated
  using (user_id = auth.uid());

-- Exercises (file upload metadata)
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  section_id  integer not null check (section_id between 1 and 16),
  file_name   text not null,
  file_path   text not null,
  uploaded_at timestamptz not null default now()
);
alter table public.exercises enable row level security;

drop policy if exists exercises_select on public.exercises;
drop policy if exists exercises_insert on public.exercises;
drop policy if exists exercises_delete on public.exercises;

create policy exercises_select on public.exercises for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy exercises_insert on public.exercises for insert to authenticated
  with check (user_id = auth.uid());
create policy exercises_delete on public.exercises for delete to authenticated
  using (user_id = auth.uid());

-- Activities (admin-managed scores/feedback per student per section)
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  section_id  integer not null check (section_id between 1 and 16),
  title       text not null,
  score       numeric(5,2),
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);
alter table public.activities enable row level security;

drop policy if exists activities_select      on public.activities;
drop policy if exists activities_admin_write on public.activities;

create policy activities_select on public.activities for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy activities_admin_write on public.activities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Assignments / deadlines (admin creates, students read)
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  section_id  integer not null check (section_id between 1 and 16),
  title       text not null,
  description text,
  due_date    timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.assignments enable row level security;

drop policy if exists assignments_select      on public.assignments;
drop policy if exists assignments_admin_write on public.assignments;

create policy assignments_select on public.assignments for select to authenticated
  using (true);
create policy assignments_admin_write on public.assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Storage bucket for exercise file uploads
insert into storage.buckets (id, name, public)
values ('exercises', 'exercises', false)
on conflict (id) do nothing;

drop policy if exists "exercises_upload"     on storage.objects;
drop policy if exists "exercises_read_own"   on storage.objects;
drop policy if exists "exercises_delete_own" on storage.objects;

create policy "exercises_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercises' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "exercises_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'exercises' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
  ));

create policy "exercises_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'exercises' and (storage.foldername(name))[1] = auth.uid()::text);
