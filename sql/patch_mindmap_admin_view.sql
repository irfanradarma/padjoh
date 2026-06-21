-- ============================================================
--  Patch: Fix admin view of student mindmap
--  get_student_mindmap_data previously only read mindmap_data
--  (individual), missing data for students in groups who save
--  to mindmap_group_data instead.
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create or replace function public.get_student_mindmap_data(p_user_id uuid, p_domain text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_group_num integer;
  v_class     text;
  v_rows      jsonb;
begin
  -- Check if student is assigned to a group for this domain
  select mg.group_num, p.class
  into v_group_num, v_class
  from public.mindmap_groups mg
  join public.profiles p on p.id = mg.user_id
  where mg.user_id = p_user_id and mg.domain = p_domain;

  if found then
    -- Student is in a group → return shared group data
    select rows into v_rows
    from public.mindmap_group_data
    where domain = p_domain and class = v_class and group_num = v_group_num;
    return coalesce(v_rows, '[]'::jsonb);
  else
    -- No group → return individual data
    select rows into v_rows
    from public.mindmap_data
    where user_id = p_user_id and domain = p_domain;
    return coalesce(v_rows, '[]'::jsonb);
  end if;
end;
$$;
grant execute on function public.get_student_mindmap_data(uuid, text) to authenticated;
