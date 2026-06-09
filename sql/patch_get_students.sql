-- Run once in: Supabase Dashboard → SQL Editor → New query
-- Returns all student profiles (bypasses RLS on profiles table).

create or replace function public.get_students()
returns table(id uuid, npm text, name text, class text)
language sql security definer set search_path = public stable as $$
  select id, npm, name, class
  from public.profiles
  where is_admin = false
  order by name;
$$;
