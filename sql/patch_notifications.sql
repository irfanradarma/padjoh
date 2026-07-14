-- ============================================================
--  Patch: Notifications + quiz answer review
--  Run AFTER patch_quiz_realtime.sql
-- ============================================================

-- 1) Notifications table
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null,   -- 'quiz', 'forum'
  title      text not null,
  ref_id     uuid,
  created_at timestamptz default now(),
  read_at    timestamptz
);
alter table public.notifications enable row level security;
drop policy if exists "own_notifications" on public.notifications;
create policy "own_notifications" on public.notifications
  for all to authenticated using (user_id = auth.uid());

-- Allow realtime delivery of notification inserts to the owner
alter publication supabase_realtime add table public.notifications;

-- 2) Get unread notifications for current user
create or replace function public.get_my_notifications()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id,
      'type', n.type,
      'title', n.title,
      'ref_id', n.ref_id,
      'created_at', n.created_at
    ) order by n.created_at desc)
    from public.notifications n
    where n.user_id = auth.uid() and n.read_at is null
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.get_my_notifications() to authenticated;

-- 3) Mark notifications read (optionally filter by type)
create or replace function public.mark_all_notifications_read(p_type text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_type is null or type = p_type);
end;
$$;
grant execute on function public.mark_all_notifications_read(text) to authenticated;

-- 4) Updated admin_deploy_quiz: also insert notifications for all students
create or replace function public.admin_deploy_quiz(p_quiz_id uuid, p_section_id integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_title text;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select title into v_title from public.quizzes where id = p_quiz_id;

  insert into public.quiz_deployments (quiz_id, section_id, deployed_by)
  values (p_quiz_id, p_section_id, auth.uid())
  on conflict (quiz_id, section_id) do update set deployed_at = now()
  returning id into v_id;

  -- Notify all non-admin users about the new quiz
  insert into public.notifications (user_id, type, title, ref_id)
  select p.id, 'quiz', 'Kuis baru: ' || coalesce(v_title, 'Kuis'), v_id
  from public.profiles p
  where p.is_admin = false;

  return v_id;
end;
$$;
grant execute on function public.admin_deploy_quiz(uuid, integer) to authenticated;

-- 5) Updated create_forum_post_v2: notify all students when admin creates a top-level post
drop function if exists public.create_forum_post_v2(text, boolean, uuid, text, text);
create or replace function public.create_forum_post_v2(
  p_content   text,
  p_is_anon   boolean default false,
  p_parent_id uuid    default null,
  p_image_url text    default null,
  p_link_url  text    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();

  insert into public.forum_posts(class, user_id, content, is_anon, parent_id, image_url, link_url)
  values (
    (select class from public.profiles where id = auth.uid()),
    auth.uid(), p_content, p_is_anon, p_parent_id, p_image_url, p_link_url
  )
  returning id into v_id;

  -- Notify all non-admin users when admin posts a new top-level thread
  if v_is_admin and p_parent_id is null then
    insert into public.notifications (user_id, type, title, ref_id)
    select p.id, 'forum', 'Postingan baru di Forum', v_id
    from public.profiles p
    where p.is_admin = false;
  end if;

  return v_id;
end;
$$;
grant execute on function public.create_forum_post_v2(text, boolean, uuid, text, text) to authenticated;

-- 6) Quiz answer review: returns each question with student's answer + correctness
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
