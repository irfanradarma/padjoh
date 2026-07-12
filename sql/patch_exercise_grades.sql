-- ============================================================
--  Patch: Exercise Grading (manual + AI)
-- ============================================================

-- 1) Grade table — one row per student per section
create table if not exists public.exercise_grades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  section_id  integer not null,
  grade       numeric(5,1),
  notes       text,
  rubric      jsonb,
  explanation text,
  graded_by   uuid references auth.users(id),
  graded_at   timestamptz default now(),
  unique (user_id, section_id)
);
alter table public.exercise_grades enable row level security;

drop policy if exists "admin_manage_exercise_grades" on public.exercise_grades;
create policy "admin_manage_exercise_grades" on public.exercise_grades
  for all to authenticated
  using ((select is_admin from public.profiles where id = auth.uid()));

drop policy if exists "own_exercise_grade" on public.exercise_grades;
create policy "own_exercise_grade" on public.exercise_grades
  for select to authenticated
  using (user_id = auth.uid());

-- 2) Admin: save / upsert a student's grade
create or replace function public.admin_save_exercise_grade(
  p_user_id     uuid,
  p_section_id  integer,
  p_grade       numeric,
  p_notes       text    default null,
  p_rubric      jsonb   default null,
  p_explanation text    default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  insert into public.exercise_grades
    (user_id, section_id, grade, notes, rubric, explanation, graded_by, graded_at)
  values
    (p_user_id, p_section_id, p_grade, p_notes, p_rubric, p_explanation, auth.uid(), now())
  on conflict (user_id, section_id) do update set
    grade       = excluded.grade,
    notes       = excluded.notes,
    rubric      = excluded.rubric,
    explanation = excluded.explanation,
    graded_by   = excluded.graded_by,
    graded_at   = excluded.graded_at;
end;
$$;
grant execute on function public.admin_save_exercise_grade(uuid, integer, numeric, text, jsonb, text) to authenticated;

-- 3) Admin: get all grades for a section
create or replace function public.admin_get_exercise_grades(p_section_id integer)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',     eg.user_id,
      'grade',       eg.grade,
      'notes',       eg.notes,
      'explanation', eg.explanation,
      'graded_at',   eg.graded_at
    ))
    from public.exercise_grades eg
    where eg.section_id = p_section_id
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_get_exercise_grades(integer) to authenticated;

-- 4) Student: read own grade for a section
create or replace function public.get_my_exercise_grade(p_section_id integer)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  return (
    select jsonb_build_object(
      'grade',     eg.grade,
      'notes',     eg.notes,
      'graded_at', eg.graded_at
    )
    from public.exercise_grades eg
    where eg.user_id = auth.uid() and eg.section_id = p_section_id
  );
end;
$$;
grant execute on function public.get_my_exercise_grade(integer) to authenticated;
