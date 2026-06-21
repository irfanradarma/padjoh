-- ============================================================
--  Patch: Quiz Submit Button
--  Run AFTER patch_quiz.sql
-- ============================================================

-- 1) Add submission timestamp to check-ins
alter table public.quiz_checkins
  add column if not exists submitted_at timestamptz;

-- 2) Student: submit their quiz (locks answers, records speed timestamp)
create or replace function public.quiz_submit(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.quiz_sessions where id = p_session_id;
  if v_status != 'active' then raise exception 'Kuis tidak aktif'; end if;
  if not exists (
    select 1 from public.quiz_checkins
    where session_id = p_session_id and user_id = auth.uid()
  ) then raise exception 'Anda belum check-in'; end if;

  update public.quiz_checkins
  set submitted_at = now()
  where session_id = p_session_id and user_id = auth.uid() and submitted_at is null;
end;
$$;
grant execute on function public.quiz_submit(uuid) to authenticated;

-- 3) Replace admin_end_quiz — use submitted_at for speed (full time if never submitted)
create or replace function public.admin_end_quiz(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_dep_id     uuid;
  v_quiz_id    uuid;
  v_time_limit integer;
  v_speed_w    smallint;
  v_acc_w      smallint;
  v_started    timestamptz;
  v_total_q    integer;
  r            record;
  v_accuracy   numeric;
  v_speed      numeric;
  v_time_used  numeric;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  update public.quiz_sessions
  set status = 'finished', finished_at = now()
  where id = p_session_id and status = 'active'
  returning deployment_id, started_at into v_dep_id, v_started;
  if v_dep_id is null then return; end if;

  select q.id, q.time_limit, q.speed_weight, q.accuracy_weight
  into v_quiz_id, v_time_limit, v_speed_w, v_acc_w
  from public.quiz_deployments d
  join public.quizzes q on q.id = d.quiz_id
  where d.id = v_dep_id;

  select count(*) into v_total_q from public.quiz_questions where quiz_id = v_quiz_id;
  if v_total_q = 0 then return; end if;

  delete from public.quiz_results where session_id = p_session_id;

  for r in select user_id from public.quiz_checkins where session_id = p_session_id loop

    -- Accuracy: % of questions answered correctly
    select count(*) filter (
      where o.is_correct and a.option_id = o.id
    )::numeric / v_total_q * 100
    into v_accuracy
    from public.quiz_answers a
    left join public.quiz_options o on o.id = a.option_id
    where a.session_id = p_session_id and a.user_id = r.user_id;
    v_accuracy := coalesce(v_accuracy, 0);

    -- Speed: elapsed seconds from quiz start to explicit submission.
    -- If student never submitted, treat as having used the full time limit (speed = 0).
    select extract(epoch from (
      coalesce(c.submitted_at, v_started + (v_time_limit * interval '1 second')) - v_started
    ))
    into v_time_used
    from public.quiz_checkins c
    where c.session_id = p_session_id and c.user_id = r.user_id;
    v_time_used := least(coalesce(v_time_used, v_time_limit), v_time_limit);
    v_speed := greatest(0, 100 - (v_time_used / v_time_limit::numeric * 100));

    insert into public.quiz_results (session_id, user_id, accuracy_score, speed_score, total_score)
    values (
      p_session_id, r.user_id,
      round(v_accuracy, 2),
      round(v_speed, 2),
      round((v_speed_w * v_speed + v_acc_w * v_accuracy) / 100.0, 2)
    );
  end loop;

  -- Rank by total score (accuracy as tiebreaker)
  with ranked as (
    select user_id,
           row_number() over (order by total_score desc, accuracy_score desc) as rn
    from public.quiz_results where session_id = p_session_id
  )
  update public.quiz_results qr
  set rank = ranked.rn
  from ranked
  where qr.session_id = p_session_id and qr.user_id = ranked.user_id;
end;
$$;
grant execute on function public.admin_end_quiz(uuid) to authenticated;
