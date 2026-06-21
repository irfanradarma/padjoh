-- ============================================================
--  Patch: Quiz System
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────

create table if not exists public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  time_limit      integer not null default 300,      -- seconds
  password        text,                               -- null = no password
  shuffle         boolean not null default false,
  speed_weight    smallint not null default 50,       -- 0–100
  accuracy_weight smallint not null default 50,
  reveal_mode     text not null default 'immediate',  -- 'immediate' | 'delayed' | 'never'
  reveal_delay    integer not null default 0,          -- minutes after finish
  tournament      boolean not null default false,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  order_num     integer not null,
  question_type text not null default 'text',   -- 'text' | 'image' | 'video'
  question_text text,
  question_url  text,
  unique(quiz_id, order_num)
);

create table if not exists public.quiz_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.quiz_questions(id) on delete cascade,
  order_num    integer not null,
  option_text  text not null,
  is_correct   boolean not null default false
);

create table if not exists public.quiz_deployments (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes(id) on delete cascade,
  section_id  integer not null,
  deployed_by uuid not null references public.profiles(id),
  deployed_at timestamptz not null default now(),
  unique(quiz_id, section_id)
);

create table if not exists public.quiz_sessions (
  id             uuid primary key default gen_random_uuid(),
  deployment_id  uuid not null references public.quiz_deployments(id) on delete cascade,
  class          text not null,
  status         text not null default 'checkin',  -- 'checkin' | 'active' | 'finished'
  started_at     timestamptz,
  finished_at    timestamptz,
  question_order jsonb,
  unique(deployment_id, class)
);

create table if not exists public.quiz_checkins (
  session_id    uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.quiz_answers (
  session_id  uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id),
  option_id   uuid references public.quiz_options(id),
  answered_at timestamptz not null default now(),
  primary key (session_id, user_id, question_id)
);

create table if not exists public.quiz_results (
  session_id     uuid not null references public.quiz_sessions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  accuracy_score numeric(5,2) not null default 0,
  speed_score    numeric(5,2) not null default 0,
  total_score    numeric(5,2) not null default 0,
  rank           integer,
  primary key (session_id, user_id)
);

-- Enable RLS (all access is via SECURITY DEFINER RPCs)
alter table public.quizzes         enable row level security;
alter table public.quiz_questions  enable row level security;
alter table public.quiz_options    enable row level security;
alter table public.quiz_deployments enable row level security;
alter table public.quiz_sessions   enable row level security;
alter table public.quiz_checkins   enable row level security;
alter table public.quiz_answers    enable row level security;
alter table public.quiz_results    enable row level security;

-- Allow realtime for quiz_sessions (students subscribe to status changes)
alter publication supabase_realtime add table public.quiz_sessions;

-- ── Admin RPCs ────────────────────────────────────────────────

create or replace function public.admin_list_quizzes()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id',               q.id,
        'title',            q.title,
        'time_limit',       q.time_limit,
        'tournament',       q.tournament,
        'question_count',   (select count(*) from public.quiz_questions qn where qn.quiz_id = q.id),
        'deployment_count', (select count(*) from public.quiz_deployments d  where d.quiz_id  = q.id),
        'created_at',       q.created_at
      ) as row_data
      from public.quizzes q
      order by q.created_at desc
    ) sub
  );
end;
$$;
grant execute on function public.admin_list_quizzes() to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_get_quiz(p_quiz_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_quiz jsonb; v_questions jsonb;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  select to_jsonb(q) - 'created_by' into v_quiz from public.quizzes q where q.id = p_quiz_id;
  if v_quiz is null then raise exception 'Quiz not found'; end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', qq.id, 'order_num', qq.order_num,
      'question_type', qq.question_type,
      'question_text', qq.question_text,
      'question_url',  qq.question_url,
      'options', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id', o.id, 'order_num', o.order_num,
                             'option_text', o.option_text, 'is_correct', o.is_correct)
          order by o.order_num
        ), '[]'::jsonb)
        from public.quiz_options o where o.question_id = qq.id
      )
    ) order by qq.order_num
  ), '[]'::jsonb) into v_questions
  from public.quiz_questions qq where qq.quiz_id = p_quiz_id;
  return v_quiz || jsonb_build_object('questions', v_questions);
end;
$$;
grant execute on function public.admin_get_quiz(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_upsert_quiz(
  p_id             uuid,
  p_title          text,
  p_time_limit     integer,
  p_password       text,
  p_shuffle        boolean,
  p_speed_weight   smallint,
  p_accuracy_weight smallint,
  p_reveal_mode    text,
  p_reveal_delay   integer,
  p_tournament     boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  if p_id is not null then
    update public.quizzes set
      title = p_title, time_limit = p_time_limit,
      password = nullif(p_password,''), shuffle = p_shuffle,
      speed_weight = p_speed_weight, accuracy_weight = p_accuracy_weight,
      reveal_mode = p_reveal_mode, reveal_delay = p_reveal_delay, tournament = p_tournament
    where id = p_id returning id into v_id;
    return v_id;
  else
    insert into public.quizzes
      (title, time_limit, password, shuffle, speed_weight, accuracy_weight,
       reveal_mode, reveal_delay, tournament, created_by)
    values
      (p_title, p_time_limit, nullif(p_password,''), p_shuffle,
       p_speed_weight, p_accuracy_weight, p_reveal_mode, p_reveal_delay,
       p_tournament, auth.uid())
    returning id into v_id;
    return v_id;
  end if;
end;
$$;
grant execute on function public.admin_upsert_quiz(uuid,text,integer,text,boolean,smallint,smallint,text,integer,boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Replaces all questions atomically
-- p_questions: [{order_num, question_type, question_text, question_url, options:[{order_num, option_text, is_correct}]}]
create or replace function public.admin_save_quiz_questions(p_quiz_id uuid, p_questions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare q jsonb; o jsonb; v_qid uuid;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  delete from public.quiz_questions where quiz_id = p_quiz_id;
  for q in select * from jsonb_array_elements(p_questions) loop
    insert into public.quiz_questions (quiz_id, order_num, question_type, question_text, question_url)
    values (
      p_quiz_id,
      (q->>'order_num')::integer,
      coalesce(q->>'question_type', 'text'),
      q->>'question_text',
      q->>'question_url'
    ) returning id into v_qid;
    for o in select * from jsonb_array_elements(q->'options') loop
      insert into public.quiz_options (question_id, order_num, option_text, is_correct)
      values (
        v_qid,
        (o->>'order_num')::integer,
        o->>'option_text',
        coalesce((o->>'is_correct')::boolean, false)
      );
    end loop;
  end loop;
end;
$$;
grant execute on function public.admin_save_quiz_questions(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_delete_quiz(p_quiz_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  delete from public.quizzes where id = p_quiz_id;
end;
$$;
grant execute on function public.admin_delete_quiz(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_deploy_quiz(p_quiz_id uuid, p_section_id integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  insert into public.quiz_deployments (quiz_id, section_id, deployed_by)
  values (p_quiz_id, p_section_id, auth.uid())
  on conflict (quiz_id, section_id) do update set deployed_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_deploy_quiz(uuid, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_undeploy_quiz(p_deployment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  delete from public.quiz_deployments where id = p_deployment_id;
end;
$$;
grant execute on function public.admin_undeploy_quiz(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Admin: get all deployments for a section with per-class session info
create or replace function public.get_section_quiz_deployments(p_section_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb) from (
      select jsonb_build_object(
        'deployment_id', d.id,
        'quiz_id',       q.id,
        'title',         q.title,
        'time_limit',    q.time_limit,
        'tournament',    q.tournament,
        'deployed_at',   d.deployed_at,
        'sessions', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'session_id',   qs.id,
              'class',        qs.class,
              'status',       qs.status,
              'started_at',   qs.started_at,
              'finished_at',  qs.finished_at,
              'checkin_count',(select count(*) from public.quiz_checkins c where c.session_id = qs.id)
            ) order by qs.class
          ), '[]'::jsonb)
          from public.quiz_sessions qs where qs.deployment_id = d.id
        )
      ) as row_data
      from public.quiz_deployments d
      join public.quizzes q on q.id = d.quiz_id
      where d.section_id = p_section_id
      order by d.deployed_at desc
    ) sub
  );
end;
$$;
grant execute on function public.get_section_quiz_deployments(integer) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Admin: open check-in for a specific class (creates or reopens session)
create or replace function public.admin_open_checkin(p_deployment_id uuid, p_class text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_session_id uuid;
  v_quiz_id    uuid;
  v_shuffle    boolean;
  v_q_order    jsonb;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  select q.id, q.shuffle into v_quiz_id, v_shuffle
  from public.quiz_deployments d
  join public.quizzes q on q.id = d.quiz_id
  where d.id = p_deployment_id;

  if v_shuffle then
    select jsonb_agg(id) into v_q_order
    from (select id from public.quiz_questions where quiz_id = v_quiz_id order by random()) s;
  else
    select jsonb_agg(id order by order_num) into v_q_order
    from public.quiz_questions where quiz_id = v_quiz_id;
  end if;

  insert into public.quiz_sessions (deployment_id, class, status, question_order)
  values (p_deployment_id, p_class, 'checkin', v_q_order)
  on conflict (deployment_id, class)
  do update set status = 'checkin', question_order = excluded.question_order,
               started_at = null, finished_at = null
  returning id into v_session_id;

  -- Clear previous checkins/answers/results when reopening
  delete from public.quiz_checkins where session_id = v_session_id;
  delete from public.quiz_results   where session_id = v_session_id;

  return v_session_id;
end;
$$;
grant execute on function public.admin_open_checkin(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_start_quiz(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  update public.quiz_sessions
  set status = 'active', started_at = now()
  where id = p_session_id and status = 'checkin';
end;
$$;
grant execute on function public.admin_start_quiz(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.admin_end_quiz(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_dep_id      uuid;
  v_quiz_id     uuid;
  v_time_limit  integer;
  v_speed_w     smallint;
  v_acc_w       smallint;
  v_started     timestamptz;
  v_finished    timestamptz;
  v_total_q     integer;
  r             record;
  v_accuracy    numeric;
  v_speed       numeric;
  v_time_used   numeric;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  v_finished := now();
  update public.quiz_sessions
  set status = 'finished', finished_at = v_finished
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
    -- Accuracy: % of correct answers
    select count(*) filter (
      where o.is_correct and a.option_id = o.id
    )::numeric / v_total_q * 100
    into v_accuracy
    from public.quiz_answers a
    left join public.quiz_options o on o.id = a.option_id
    where a.session_id = p_session_id and a.user_id = r.user_id;
    v_accuracy := coalesce(v_accuracy, 0);

    -- Speed: based on when last answer was submitted
    select extract(epoch from (max(a.answered_at) - v_started))
    into v_time_used
    from public.quiz_answers a
    where a.session_id = p_session_id and a.user_id = r.user_id;
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

  -- Assign ranks
  with ranked as (
    select user_id, row_number() over (order by total_score desc, accuracy_score desc) as rn
    from public.quiz_results where session_id = p_session_id
  )
  update public.quiz_results qr
  set rank = ranked.rn
  from ranked where qr.session_id = p_session_id and qr.user_id = ranked.user_id;
end;
$$;
grant execute on function public.admin_end_quiz(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Admin: get full session monitor data
create or replace function public.admin_get_session_monitor(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_session  jsonb;
  v_quiz     jsonb;
  v_checkins jsonb;
  v_results  jsonb;
  v_class    text;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  select jsonb_build_object(
    'id', qs.id, 'class', qs.class, 'status', qs.status,
    'started_at', qs.started_at, 'finished_at', qs.finished_at,
    'question_order', qs.question_order
  ), qs.class into v_session, v_class
  from public.quiz_sessions qs where qs.id = p_session_id;

  select jsonb_build_object(
    'id', q.id, 'title', q.title, 'time_limit', q.time_limit,
    'tournament', q.tournament, 'speed_weight', q.speed_weight,
    'accuracy_weight', q.accuracy_weight,
    'reveal_mode', q.reveal_mode, 'reveal_delay', q.reveal_delay,
    'password', q.password
  ) into v_quiz
  from public.quiz_sessions qs
  join public.quiz_deployments d on d.id = qs.deployment_id
  join public.quizzes q on q.id = d.quiz_id
  where qs.id = p_session_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', p.id, 'name', p.name, 'npm', p.npm,
      'checked_in', (c.user_id is not null),
      'checked_in_at', c.checked_in_at
    ) order by p.name
  ), '[]'::jsonb) into v_checkins
  from public.profiles p
  left join public.quiz_checkins c on c.session_id = p_session_id and c.user_id = p.id
  where p.class = v_class and p.is_admin = false;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', qr.user_id, 'name', p.name, 'npm', p.npm,
      'accuracy', qr.accuracy_score, 'speed', qr.speed_score,
      'total', qr.total_score, 'rank', qr.rank
    ) order by qr.rank
  ), '[]'::jsonb) into v_results
  from public.quiz_results qr
  join public.profiles p on p.id = qr.user_id
  where qr.session_id = p_session_id;

  return jsonb_build_object(
    'session', v_session, 'quiz', v_quiz,
    'checkins', v_checkins,
    'results', coalesce(v_results, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.admin_get_session_monitor(uuid) to authenticated;

-- ── Student RPCs ──────────────────────────────────────────────

-- Student: list quizzes available in a section for my class
create or replace function public.get_section_quizzes(p_section_id integer)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_uid   uuid := auth.uid();
  v_class text;
begin
  select class into v_class from public.profiles where id = v_uid;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb) from (
      select jsonb_build_object(
        'deployment_id', d.id,
        'quiz_id',       q.id,
        'title',         q.title,
        'time_limit',    q.time_limit,
        'tournament',    q.tournament,
        'has_password',  (q.password is not null),
        'session_id',    qs.id,
        'status',        coalesce(qs.status, 'not_open'),
        'started_at',    qs.started_at,
        'is_checked_in', (
          select count(*) > 0 from public.quiz_checkins c
          where c.session_id = qs.id and c.user_id = v_uid
        ),
        'my_result', (
          select jsonb_build_object('total', qr.total_score, 'rank', qr.rank)
          from public.quiz_results qr
          where qr.session_id = qs.id and qr.user_id = v_uid
        )
      ) as row_data
      from public.quiz_deployments d
      join public.quizzes q on q.id = d.quiz_id
      left join public.quiz_sessions qs
        on qs.deployment_id = d.id and qs.class = v_class
      where d.section_id = p_section_id
      order by d.deployed_at desc
    ) sub
  );
end;
$$;
grant execute on function public.get_section_quizzes(integer) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.quiz_checkin(p_session_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status    text;
  v_password  text;
  v_class     text;
  v_my_class  text;
begin
  select qs.status, q.password, qs.class
  into v_status, v_password, v_class
  from public.quiz_sessions qs
  join public.quiz_deployments d on d.id = qs.deployment_id
  join public.quizzes q on q.id = d.quiz_id
  where qs.id = p_session_id;

  if v_status != 'checkin' then raise exception 'Kuis belum dibuka untuk check-in'; end if;
  if v_password is not null and v_password != coalesce(p_password,'') then
    raise exception 'Password salah';
  end if;
  select class into v_my_class from public.profiles where id = auth.uid();
  if v_my_class != v_class then raise exception 'Kelas tidak sesuai dengan sesi ini'; end if;

  insert into public.quiz_checkins (session_id, user_id)
  values (p_session_id, auth.uid())
  on conflict do nothing;
end;
$$;
grant execute on function public.quiz_checkin(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Get questions (only when session is active or finished and student is checked in)
create or replace function public.get_quiz_questions(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_uid      uuid := auth.uid();
  v_status   text;
  v_quiz_id  uuid;
  v_q_order  jsonb;
  v_is_admin boolean;
begin
  v_is_admin := (select is_admin from public.profiles where id = v_uid);
  select qs.status, d.quiz_id, qs.question_order
  into v_status, v_quiz_id, v_q_order
  from public.quiz_sessions qs
  join public.quiz_deployments d on d.id = qs.deployment_id
  where qs.id = p_session_id;

  if v_status not in ('active','finished') then raise exception 'Kuis belum dimulai'; end if;
  if not v_is_admin then
    if not exists (select 1 from public.quiz_checkins where session_id = p_session_id and user_id = v_uid) then
      raise exception 'Anda belum check-in';
    end if;
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', qq.id, 'order_num', qq.order_num,
        'question_type', qq.question_type,
        'question_text', qq.question_text,
        'question_url',  qq.question_url,
        'options', (
          select coalesce(jsonb_agg(
            jsonb_build_object('id', o.id, 'order_num', o.order_num, 'option_text', o.option_text)
            order by o.order_num
          ), '[]'::jsonb)
          from public.quiz_options o where o.question_id = qq.id
        ),
        'my_answer', (
          select option_id from public.quiz_answers
          where session_id = p_session_id and user_id = v_uid and question_id = qq.id
        )
      )
      order by
        case when v_q_order is not null then
          array_position(
            array(select value::uuid from jsonb_array_elements_text(v_q_order)),
            qq.id
          )
        else qq.order_num end
    ), '[]'::jsonb)
    from public.quiz_questions qq where qq.quiz_id = v_quiz_id
  );
end;
$$;
grant execute on function public.get_quiz_questions(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
create or replace function public.quiz_submit_answer(
  p_session_id uuid, p_question_id uuid, p_option_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.quiz_sessions where id = p_session_id;
  if v_status != 'active' then raise exception 'Kuis tidak aktif'; end if;
  if not exists (select 1 from public.quiz_checkins where session_id = p_session_id and user_id = auth.uid()) then
    raise exception 'Anda belum check-in';
  end if;
  insert into public.quiz_answers (session_id, user_id, question_id, option_id, answered_at)
  values (p_session_id, auth.uid(), p_question_id, p_option_id, now())
  on conflict (session_id, user_id, question_id)
  do update set option_id = excluded.option_id, answered_at = now();
end;
$$;
grant execute on function public.quiz_submit_answer(uuid, uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Get all results for a finished session (for tournament pairing on client)
create or replace function public.get_quiz_results(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
  v_reveal_mode  text;
  v_reveal_delay integer;
  v_finished     timestamptz;
  v_reveal       boolean;
begin
  select qs.status, q.reveal_mode, q.reveal_delay, qs.finished_at
  into v_status, v_reveal_mode, v_reveal_delay, v_finished
  from public.quiz_sessions qs
  join public.quiz_deployments d on d.id = qs.deployment_id
  join public.quizzes q on q.id = d.quiz_id
  where qs.id = p_session_id;

  if v_status != 'finished' then return null; end if;

  -- Check access
  if not (select is_admin from public.profiles where id = v_uid) then
    if not exists (select 1 from public.quiz_checkins where session_id = p_session_id and user_id = v_uid) then
      raise exception 'Unauthorized';
    end if;
  end if;

  v_reveal := case
    when v_reveal_mode = 'immediate' then true
    when v_reveal_mode = 'delayed'   then
      v_finished is not null and now() >= v_finished + (v_reveal_delay * interval '1 minute')
    else false
  end;

  return jsonb_build_object(
    'results', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'user_id', qr.user_id, 'name', p.name, 'npm', p.npm,
          'accuracy', qr.accuracy_score, 'speed', qr.speed_score,
          'total', qr.total_score, 'rank', qr.rank
        ) order by qr.rank
      ), '[]'::jsonb)
      from public.quiz_results qr
      join public.profiles p on p.id = qr.user_id
      where qr.session_id = p_session_id
    ),
    'my_result', (
      select jsonb_build_object(
        'accuracy', qr.accuracy_score, 'speed', qr.speed_score,
        'total', qr.total_score, 'rank', qr.rank
      )
      from public.quiz_results qr
      where qr.session_id = p_session_id and qr.user_id = v_uid
    ),
    'correct_options', case when v_reveal then (
      select coalesce(jsonb_agg(o.id), '[]'::jsonb)
      from public.quiz_options o
      join public.quiz_questions qq on qq.id = o.question_id
      join public.quiz_deployments d on d.quiz_id = qq.quiz_id
      join public.quiz_sessions qs on qs.deployment_id = d.id
      where qs.id = p_session_id and o.is_correct = true
    ) else null end,
    'my_answers', case when v_reveal then (
      select coalesce(jsonb_agg(
        jsonb_build_object('question_id', a.question_id, 'option_id', a.option_id)
      ), '[]'::jsonb)
      from public.quiz_answers a
      where a.session_id = p_session_id and a.user_id = v_uid
    ) else null end
  );
end;
$$;
grant execute on function public.get_quiz_results(uuid) to authenticated;
