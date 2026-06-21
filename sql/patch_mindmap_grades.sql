-- ============================================================
--  Patch: Mindmap AI Grading
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Grade storage — one row per group per domain
create table if not exists public.mindmap_grades (
  domain       text    not null,
  class        text    not null,
  group_num    integer not null,
  grade        numeric(5,2),
  explanation  text,   -- JSON string from AI (scores array + summary)
  rubric_used  jsonb,
  graded_at    timestamptz not null default now(),
  primary key (domain, class, group_num)
);
alter table public.mindmap_grades enable row level security;

-- Students can read their own group's grade
create policy "students_read_own_grade" on public.mindmap_grades
  for select to authenticated
  using (
    exists (
      select 1 from public.mindmap_groups mg
      join public.profiles p on p.id = mg.user_id
      where mg.user_id    = auth.uid()
        and mg.domain     = mindmap_grades.domain
        and mg.group_num  = mindmap_grades.group_num
        and p.class       = mindmap_grades.class
    )
  );

-- 2) Admin: save / overwrite a group's grade
create or replace function public.admin_save_mindmap_grade(
  p_domain      text,
  p_class       text,
  p_group_num   integer,
  p_grade       numeric,
  p_explanation text,
  p_rubric      jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  insert into public.mindmap_grades (domain, class, group_num, grade, explanation, rubric_used, graded_at)
  values (p_domain, p_class, p_group_num, p_grade, p_explanation, p_rubric, now())
  on conflict (domain, class, group_num)
  do update set
    grade       = excluded.grade,
    explanation = excluded.explanation,
    rubric_used = excluded.rubric_used,
    graded_at   = now();
end;
$$;
grant execute on function public.admin_save_mindmap_grade(text, text, integer, numeric, text, jsonb) to authenticated;

-- 3) Admin: list all students with their group grade for a domain
create or replace function public.admin_get_mindmap_grades(p_domain text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'student_id',  p.id,
        'name',        p.name,
        'npm',         p.npm,
        'class',       p.class,
        'group_num',   mg.group_num,
        'grade',       gr.grade,
        'explanation', gr.explanation,
        'graded_at',   gr.graded_at
      ) as row_data
      from public.profiles p
      left join public.mindmap_groups mg
        on mg.user_id = p.id and mg.domain = p_domain
      left join public.mindmap_grades gr
        on gr.domain    = p_domain
       and gr.class     = p.class
       and gr.group_num = mg.group_num
      where p.is_admin = false
      order by p.class, p.name
    ) sub
  );
end;
$$;
grant execute on function public.admin_get_mindmap_grades(text) to authenticated;

-- 4) Admin: get a specific group's mindmap rows (to send to AI)
create or replace function public.admin_get_group_mindmap_data(
  p_domain    text,
  p_class     text,
  p_group_num integer
) returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(rows, '[]'::jsonb)
  from public.mindmap_group_data
  where domain = p_domain and class = p_class and group_num = p_group_num;
$$;
grant execute on function public.admin_get_group_mindmap_data(text, text, integer) to authenticated;

-- 5) Student: read own grade
create or replace function public.get_my_mindmap_grade(p_domain text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_group_num integer;
  v_class     text;
begin
  select mg.group_num, p.class into v_group_num, v_class
  from public.mindmap_groups mg
  join public.profiles p on p.id = mg.user_id
  where mg.user_id = auth.uid() and mg.domain = p_domain;

  if not found then return null; end if;

  return (
    select jsonb_build_object(
      'grade',       grade,
      'explanation', explanation,
      'graded_at',   graded_at
    )
    from public.mindmap_grades
    where domain = p_domain and class = v_class and group_num = v_group_num
  );
end;
$$;
grant execute on function public.get_my_mindmap_grade(text) to authenticated;
