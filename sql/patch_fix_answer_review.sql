-- ============================================================
--  Fix: get_my_answer_review referenced a non-existent column
--  (quiz_deployments.reveal_answers), which errored silently and
--  made the "Tinjauan Jawaban" review always come back empty even
--  after "Kunci jawaban telah dirilis" was shown.
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create or replace function public.get_my_answer_review(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_dep_id         uuid;
  v_quiz_id        uuid;
  v_reveal         boolean;
  v_session_status text;
  v_reveal_mode    text;
  v_reveal_delay   integer;
  v_finished       timestamptz;
begin
  select status, deployment_id, finished_at
  into v_session_status, v_dep_id, v_finished
  from public.quiz_sessions where id = p_session_id;

  if v_session_status != 'finished' then
    raise exception 'Kuis belum selesai';
  end if;

  if not (select is_admin from public.profiles where id = auth.uid()) then
    if not exists (
      select 1 from public.quiz_checkins
      where session_id = p_session_id and user_id = auth.uid()
    ) then raise exception 'Unauthorized'; end if;
  end if;

  select q.id, q.reveal_mode, q.reveal_delay
  into v_quiz_id, v_reveal_mode, v_reveal_delay
  from public.quiz_deployments qd
  join public.quizzes q on q.id = qd.quiz_id
  where qd.id = v_dep_id;

  v_reveal := case
    when v_reveal_mode = 'immediate' then true
    when v_reveal_mode = 'delayed'   then
      v_finished is not null and now() >= v_finished + (v_reveal_delay * interval '1 minute')
    else false
  end;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'question_id',   qq.id,
        'question_text', qq.question_text,
        'question_type', qq.question_type,
        'question_url',  qq.question_url,
        'order_num',     qq.order_num,
        'my_option_id', (
          select option_id from public.quiz_answers
          where session_id = p_session_id and user_id = auth.uid() and question_id = qq.id
        ),
        'is_correct', coalesce((
          select qo.is_correct
          from public.quiz_answers qa
          join public.quiz_options qo on qo.id = qa.option_id
          where qa.session_id = p_session_id and qa.user_id = auth.uid()
            and qa.question_id = qq.id
        ), false),
        'options', (
          select jsonb_agg(
            jsonb_build_object(
              'id',          qo.id,
              'option_text', qo.option_text,
              'is_correct',  case when v_reveal then qo.is_correct else false end
            ) order by qo.order_num
          )
          from public.quiz_options qo
          where qo.question_id = qq.id
        )
      ) order by qq.order_num
    )
    from public.quiz_questions qq
    where qq.quiz_id = v_quiz_id
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.get_my_answer_review(uuid) to authenticated;
