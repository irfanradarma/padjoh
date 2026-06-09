-- Run once in: Supabase Dashboard → SQL Editor → New query
-- Adds a security-definer function so students can upsert their own notes
-- without being blocked by RLS on the notes table.

create or replace function public.save_note(
  p_section_id integer,
  p_content    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notes (user_id, section_id, content, updated_at)
  values (auth.uid(), p_section_id, p_content, now())
  on conflict (user_id, section_id)
  do update set
    content    = excluded.content,
    updated_at = excluded.updated_at;
end;
$$;
