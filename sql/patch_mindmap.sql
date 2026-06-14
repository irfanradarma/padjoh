-- ============================================================
--  Patch: Mind Map data storage per student per domain
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Table: one row per (student, domain), stores all sheet rows as JSONB
create table if not exists public.mindmap_data (
  user_id    uuid not null references auth.users(id) on delete cascade,
  domain     text not null check (domain in ('D2','D3','D4','D5')),
  rows       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, domain)
);
alter table public.mindmap_data enable row level security;

-- RPC: student saves their own data for a domain
create or replace function public.save_mindmap(p_domain text, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.mindmap_data (user_id, domain, rows, updated_at)
  values (auth.uid(), p_domain, p_rows, now())
  on conflict (user_id, domain)
  do update set rows = excluded.rows, updated_at = now();
end;
$$;
grant execute on function public.save_mindmap(text, jsonb) to authenticated;

-- RPC: student reads their own data for a domain
create or replace function public.get_my_mindmap(p_domain text)
returns jsonb language sql security definer set search_path = public stable as $$
  select rows from public.mindmap_data
  where user_id = auth.uid() and domain = p_domain;
$$;
grant execute on function public.get_my_mindmap(text) to authenticated;

-- RPC: admin reads any student's data for a domain
create or replace function public.get_student_mindmap_data(p_user_id uuid, p_domain text)
returns jsonb language sql security definer set search_path = public stable as $$
  select rows from public.mindmap_data
  where user_id = p_user_id and domain = p_domain;
$$;
grant execute on function public.get_student_mindmap_data(uuid, text) to authenticated;
