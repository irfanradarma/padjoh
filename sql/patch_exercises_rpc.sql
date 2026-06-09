-- Run once in: Supabase Dashboard → SQL Editor → New query
-- Security-definer RPCs for exercises table (bypasses RLS).

-- Student: save uploaded file metadata, returns new row id
create or replace function public.save_exercise(
  p_section_id integer,
  p_file_name  text,
  p_file_path  text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.exercises(user_id, section_id, file_name, file_path)
  values (auth.uid(), p_section_id, p_file_name, p_file_path)
  returning id into v_id;
  return v_id;
end;
$$;

-- Student: list own uploads for a section
create or replace function public.get_my_exercises(p_section_id integer)
returns table(id uuid, file_name text, file_path text, uploaded_at timestamptz)
language sql security definer set search_path = public stable as $$
  select id, file_name, file_path, uploaded_at
  from public.exercises
  where user_id = auth.uid() and section_id = p_section_id
  order by uploaded_at desc;
$$;

-- Student: delete own upload
create or replace function public.delete_exercise(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.exercises where id = p_id and user_id = auth.uid();
end;
$$;

-- Admin: list all uploads for a section
create or replace function public.get_section_exercises(p_section_id integer)
returns table(id uuid, user_id uuid, file_name text, file_path text, uploaded_at timestamptz)
language sql security definer set search_path = public stable as $$
  select id, user_id, file_name, file_path, uploaded_at
  from public.exercises
  where section_id = p_section_id
  order by uploaded_at desc;
$$;
