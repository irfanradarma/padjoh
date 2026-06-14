-- ============================================================
--  Patch: Assignments / Deadline management
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Table
create table if not exists public.assignments (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  description text        not null default '',
  due_date    timestamptz not null,
  section_id  int         references public.profiles(id) on delete set null, -- loose ref; NULL = no specific section
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- section_id is just an integer key into the SECTIONS list, not a FK to profiles.
-- Re-create without the wrong FK:
alter table public.assignments drop column if exists section_id;
alter table public.assignments add column if not exists section_id int;

alter table public.assignments enable row level security;

-- ── RPCs ───────────────────────────────────────────────────

-- All students: upcoming assignments (due_date >= now)
create or replace function public.get_assignments()
returns table (
  id          uuid,
  title       text,
  description text,
  due_date    timestamptz,
  section_id  int,
  created_at  timestamptz
)
language sql security definer set search_path = public stable as $$
  select id, title, description, due_date, section_id, created_at
  from public.assignments
  where due_date >= now() - interval '1 day'
  order by due_date asc;
$$;
grant execute on function public.get_assignments() to authenticated;

-- Admin: all assignments (past + future) for management view
create or replace function public.get_all_assignments()
returns table (
  id          uuid,
  title       text,
  description text,
  due_date    timestamptz,
  section_id  int,
  created_at  timestamptz
)
language sql security definer set search_path = public stable as $$
  select id, title, description, due_date, section_id, created_at
  from public.assignments
  order by due_date desc;
$$;
grant execute on function public.get_all_assignments() to authenticated;

-- Admin: create or update an assignment
create or replace function public.upsert_assignment(
  p_title       text,
  p_description text,
  p_due_date    timestamptz,
  p_section_id  int    default null,
  p_id          uuid   default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_admin bool;
  v_id    uuid;
begin
  select is_admin into v_admin from public.profiles where id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'Access denied: admin only';
  end if;

  if p_id is null then
    insert into public.assignments (title, description, due_date, section_id)
    values (p_title, p_description, p_due_date, p_section_id)
    returning id into v_id;
  else
    update public.assignments
    set title = p_title, description = p_description,
        due_date = p_due_date, section_id = p_section_id, updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
grant execute on function public.upsert_assignment(text,text,timestamptz,int,uuid) to authenticated;

-- Admin: delete an assignment
create or replace function public.delete_assignment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_admin bool;
begin
  select is_admin into v_admin from public.profiles where id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'Access denied: admin only';
  end if;
  delete from public.assignments where id = p_id;
end;
$$;
grant execute on function public.delete_assignment(uuid) to authenticated;

-- Count of non-empty notes for current user (used in dashboard)
create or replace function public.get_my_note_count()
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.notes
  where user_id = auth.uid() and content <> '';
$$;
grant execute on function public.get_my_note_count() to authenticated;
