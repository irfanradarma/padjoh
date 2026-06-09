-- Run once in: Supabase Dashboard → SQL Editor → New query
-- Security-definer read helpers for notes (bypasses RLS, same pattern as get_my_profile).

-- Student: read own note for a section
create or replace function public.get_note(p_section_id integer)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select content
  from public.notes
  where user_id = auth.uid()
    and section_id = p_section_id
  limit 1;
$$;

-- Admin: read all notes for a section
create or replace function public.get_section_notes(p_section_id integer)
returns table(user_id uuid, content text)
language sql
security definer
set search_path = public
stable
as $$
  select user_id, content
  from public.notes
  where section_id = p_section_id;
$$;
