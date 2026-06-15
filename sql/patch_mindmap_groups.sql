-- ============================================================
--  Patch: Mind Map Group Assignments + Collaborative Editing
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Group assignments: which student is in which group per domain
create table if not exists public.mindmap_groups (
  domain      text not null check (domain in ('D2','D3','D4','D5')),
  user_id     uuid not null references auth.users(id) on delete cascade,
  group_num   integer not null check (group_num > 0),
  assigned_at timestamptz not null default now(),
  primary key (domain, user_id)
);
alter table public.mindmap_groups enable row level security;
grant all on public.mindmap_groups to service_role;

-- 2) Shared group mindmap data (collaborative)
create table if not exists public.mindmap_group_data (
  domain      text not null check (domain in ('D2','D3','D4','D5')),
  class       text not null,
  group_num   integer not null check (group_num > 0),
  rows        jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  primary key (domain, class, group_num)
);
alter table public.mindmap_group_data enable row level security;
grant all on public.mindmap_group_data to service_role;

-- 3) RLS: group members can read their group's shared data (needed for Realtime)
create policy "group_members_can_read" on public.mindmap_group_data
  for select to authenticated
  using (
    exists (
      select 1
      from public.mindmap_groups mg
      join public.profiles p on p.id = mg.user_id
      where mg.user_id    = auth.uid()
        and mg.domain     = mindmap_group_data.domain
        and mg.group_num  = mindmap_group_data.group_num
        and p.class       = mindmap_group_data.class
    )
  );

-- 4) Enable Realtime for live collaborative updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'mindmap_group_data'
  ) then
    execute 'alter publication supabase_realtime add table public.mindmap_group_data';
  end if;
end;
$$;

-- 5) Admin: save group assignments for a domain (replaces existing)
create or replace function public.admin_save_mindmap_groups(
  p_domain      text,
  p_assignments jsonb   -- [{user_id, group_num}, ...]
) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.mindmap_groups where domain = p_domain;
  insert into public.mindmap_groups (domain, user_id, group_num, assigned_at)
  select
    p_domain,
    (item->>'user_id')::uuid,
    (item->>'group_num')::integer,
    now()
  from jsonb_array_elements(p_assignments) item
  where (item->>'group_num') is not null
    and (item->>'group_num')::integer > 0;
end;
$$;
grant execute on function public.admin_save_mindmap_groups(text, jsonb) to authenticated;

-- 6) Admin: list all students with their current group assignment for a domain
create or replace function public.admin_get_mindmap_groups(p_domain text)
returns table(id uuid, npm text, name text, class text, group_num integer)
language sql security definer set search_path = public stable as $$
  select
    p.id,
    p.npm,
    p.name,
    p.class,
    mg.group_num
  from public.profiles p
  left join public.mindmap_groups mg
    on mg.user_id = p.id and mg.domain = p_domain
  where p.is_admin = false
  order by p.class, p.name;
$$;
grant execute on function public.admin_get_mindmap_groups(text) to authenticated;

-- 7) Student: get own group info + member list for a domain
create or replace function public.get_my_mindmap_group(p_domain text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_group_num integer;
  v_class     text;
  v_members   jsonb;
begin
  select mg.group_num, p.class
  into v_group_num, v_class
  from public.mindmap_groups mg
  join public.profiles p on p.id = mg.user_id
  where mg.user_id = auth.uid() and mg.domain = p_domain;

  if not found then return null; end if;

  select jsonb_agg(
    jsonb_build_object('npm', p.npm, 'name', p.name)
    order by p.name
  )
  into v_members
  from public.mindmap_groups mg
  join public.profiles p on p.id = mg.user_id
  where mg.domain = p_domain
    and mg.group_num = v_group_num
    and p.class = v_class;

  return jsonb_build_object(
    'group_num', v_group_num,
    'class',     v_class,
    'members',   coalesce(v_members, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_my_mindmap_group(text) to authenticated;

-- 8) Student: get the shared mind map rows for own group
create or replace function public.get_group_mindmap(p_domain text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_group_num integer;
  v_class     text;
  v_rows      jsonb;
begin
  select mg.group_num, p.class
  into v_group_num, v_class
  from public.mindmap_groups mg
  join public.profiles p on p.id = mg.user_id
  where mg.user_id = auth.uid() and mg.domain = p_domain;

  if not found then return '[]'::jsonb; end if;

  select rows into v_rows
  from public.mindmap_group_data
  where domain = p_domain and class = v_class and group_num = v_group_num;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;
grant execute on function public.get_group_mindmap(text) to authenticated;

-- 9) Student: save the shared mind map rows for own group
create or replace function public.save_group_mindmap(p_domain text, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_group_num integer;
  v_class     text;
begin
  select mg.group_num, p.class
  into v_group_num, v_class
  from public.mindmap_groups mg
  join public.profiles p on p.id = mg.user_id
  where mg.user_id = auth.uid() and mg.domain = p_domain;

  if not found then
    raise exception 'User not assigned to a group for domain %', p_domain;
  end if;

  insert into public.mindmap_group_data
    (domain, class, group_num, rows, updated_at, updated_by)
  values
    (p_domain, v_class, v_group_num, p_rows, now(), auth.uid())
  on conflict (domain, class, group_num)
  do update set
    rows       = excluded.rows,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;
grant execute on function public.save_group_mindmap(text, jsonb) to authenticated;
