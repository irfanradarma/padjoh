-- ============================================================
--  Patch: Vibers — classroom product showcase system
--  Run AFTER patch_notifications.sql
-- ============================================================

-- 1) Tables

create table if not exists public.viber_iterations (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text default '',
  is_visible       boolean default false,
  submission_open  boolean default false,
  gallery_open     boolean default false,
  voting_open      boolean default false,
  leaderboard_open boolean default false,
  voting_start     timestamptz,
  voting_end       timestamptz,
  created_at       timestamptz default now()
);
alter table public.viber_iterations enable row level security;
drop policy if exists "viber_iter_admin"   on public.viber_iterations;
drop policy if exists "viber_iter_student" on public.viber_iterations;
create policy "viber_iter_admin" on public.viber_iterations
  for all to authenticated
  using ((select is_admin from public.profiles where id = auth.uid()));
create policy "viber_iter_student" on public.viber_iterations
  for select to authenticated
  using (is_visible = true);

create table if not exists public.viber_submissions (
  id            uuid primary key default gen_random_uuid(),
  iteration_id  uuid references public.viber_iterations(id) on delete cascade not null,
  student_id    uuid references auth.users(id) on delete cascade not null,
  project_title text not null default '',
  description   text default '',
  html_url      text,
  thumbnail_url text,
  submitted_at  timestamptz default now(),
  unique (iteration_id, student_id)
);
alter table public.viber_submissions enable row level security;

create table if not exists public.viber_votes (
  id            uuid primary key default gen_random_uuid(),
  iteration_id  uuid references public.viber_iterations(id) on delete cascade not null,
  voter_id      uuid references auth.users(id) on delete cascade not null,
  submission_id uuid references public.viber_submissions(id) on delete cascade not null,
  created_at    timestamptz default now(),
  unique (voter_id, submission_id)
);
alter table public.viber_votes enable row level security;

-- 2) Storage buckets

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vibers-html', 'vibers-html', true, 5242880, array['text/html', 'application/octet-stream'])
on conflict (id) do update set public = true, file_size_limit = 5242880;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vibers-thumb', 'vibers-thumb', true, 2097152,
  array['image/jpeg','image/jpg','image/png','image/gif','image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "vibers html read"   on storage.objects;
drop policy if exists "vibers html upload" on storage.objects;
drop policy if exists "vibers html delete" on storage.objects;
drop policy if exists "vibers thumb read"  on storage.objects;
drop policy if exists "vibers thumb upload" on storage.objects;
drop policy if exists "vibers thumb delete" on storage.objects;

create policy "vibers html read"   on storage.objects for select using (bucket_id = 'vibers-html');
create policy "vibers html upload" on storage.objects for insert to authenticated with check (bucket_id = 'vibers-html');
create policy "vibers html delete" on storage.objects for delete to authenticated using (bucket_id = 'vibers-html');
create policy "vibers thumb read"  on storage.objects for select using (bucket_id = 'vibers-thumb');
create policy "vibers thumb upload" on storage.objects for insert to authenticated with check (bucket_id = 'vibers-thumb');
create policy "vibers thumb delete" on storage.objects for delete to authenticated using (bucket_id = 'vibers-thumb');

-- 3) Admin RPCs

create or replace function public.admin_get_vibers_iterations()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', vi.id, 'title', vi.title, 'description', vi.description,
        'is_visible', vi.is_visible, 'submission_open', vi.submission_open,
        'gallery_open', vi.gallery_open, 'voting_open', vi.voting_open,
        'leaderboard_open', vi.leaderboard_open,
        'voting_start', vi.voting_start, 'voting_end', vi.voting_end,
        'created_at', vi.created_at,
        'submission_count', (select count(*) from public.viber_submissions s where s.iteration_id = vi.id),
        'vote_count', (select count(*) from public.viber_votes v where v.iteration_id = vi.id)
      ) order by vi.created_at
    )
    from public.viber_iterations vi
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_get_vibers_iterations() to authenticated;

create or replace function public.admin_create_vibers_iteration(p_title text, p_description text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  insert into public.viber_iterations (title, description)
  values (p_title, coalesce(p_description, ''))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_create_vibers_iteration(text, text) to authenticated;

create or replace function public.admin_update_vibers_iteration(
  p_id              uuid,
  p_title           text,
  p_description     text,
  p_is_visible      boolean,
  p_submission_open boolean,
  p_gallery_open    boolean,
  p_voting_open     boolean,
  p_leaderboard_open boolean,
  p_voting_start    timestamptz default null,
  p_voting_end      timestamptz default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_was_visible boolean;
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  select is_visible into v_was_visible from public.viber_iterations where id = p_id;
  update public.viber_iterations set
    title            = p_title,
    description      = p_description,
    is_visible       = p_is_visible,
    submission_open  = p_submission_open,
    gallery_open     = p_gallery_open,
    voting_open      = p_voting_open,
    leaderboard_open = p_leaderboard_open,
    voting_start     = p_voting_start,
    voting_end       = p_voting_end
  where id = p_id;
  -- Notify all students when iteration is first published
  if p_is_visible and not coalesce(v_was_visible, false) then
    insert into public.notifications (user_id, type, title, ref_id)
    select pp.id, 'vibers', 'Vibers baru: ' || p_title, p_id
    from public.profiles pp where pp.is_admin = false;
  end if;
end;
$$;
grant execute on function public.admin_update_vibers_iteration(uuid,text,text,boolean,boolean,boolean,boolean,boolean,timestamptz,timestamptz) to authenticated;

create or replace function public.admin_delete_vibers_iteration(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  delete from public.viber_iterations where id = p_id;
end;
$$;
grant execute on function public.admin_delete_vibers_iteration(uuid) to authenticated;

create or replace function public.admin_get_vibers_submissions(p_iteration_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', vs.id, 'student_id', vs.student_id,
        'student_name', p.name, 'student_npm', p.npm, 'student_class', p.class,
        'project_title', vs.project_title, 'description', vs.description,
        'html_url', vs.html_url, 'thumbnail_url', vs.thumbnail_url,
        'submitted_at', vs.submitted_at,
        'vote_count', (select count(*) from public.viber_votes vv where vv.submission_id = vs.id)
      ) order by p.class, p.name
    )
    from public.viber_submissions vs
    join public.profiles p on p.id = vs.student_id
    where vs.iteration_id = p_iteration_id
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_get_vibers_submissions(uuid) to authenticated;

create or replace function public.admin_reset_vibers_votes(p_iteration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  delete from public.viber_votes where iteration_id = p_iteration_id;
end;
$$;
grant execute on function public.admin_reset_vibers_votes(uuid) to authenticated;

-- 4) Student RPCs

create or replace function public.get_my_vibers_iterations()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', vi.id, 'title', vi.title, 'description', vi.description,
        'submission_open', vi.submission_open,
        'gallery_open', vi.gallery_open,
        'voting_open', vi.voting_open,
        'leaderboard_open', vi.leaderboard_open,
        'voting_start', vi.voting_start,
        'voting_end', vi.voting_end,
        'my_submission', (
          select jsonb_build_object(
            'id', vs.id, 'project_title', vs.project_title,
            'description', vs.description, 'html_url', vs.html_url,
            'thumbnail_url', vs.thumbnail_url, 'submitted_at', vs.submitted_at
          )
          from public.viber_submissions vs
          where vs.iteration_id = vi.id and vs.student_id = auth.uid()
        ),
        'my_votes', (
          select coalesce(jsonb_agg(vv.submission_id), '[]'::jsonb)
          from public.viber_votes vv
          where vv.iteration_id = vi.id and vv.voter_id = auth.uid()
        ),
        'my_votes_count', (
          select count(*) from public.viber_votes vv
          where vv.iteration_id = vi.id and vv.voter_id = auth.uid()
        )
      ) order by vi.created_at
    )
    from public.viber_iterations vi
    where vi.is_visible = true
       or (select is_admin from public.profiles where id = auth.uid())
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.get_my_vibers_iterations() to authenticated;

create or replace function public.get_vibers_gallery(p_iteration_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_class text; v_is_admin boolean;
begin
  select class, is_admin into v_class, v_is_admin from public.profiles where id = auth.uid();
  if not v_is_admin then
    if not exists (
      select 1 from public.viber_iterations
      where id = p_iteration_id and (gallery_open or voting_open or leaderboard_open)
    ) then raise exception 'Gallery belum dibuka'; end if;
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'submission_id', vs.id,
        'student_id', vs.student_id,
        'student_name', p.name,
        'student_npm', p.npm,
        'is_me', vs.student_id = auth.uid(),
        'project_title', vs.project_title,
        'description', vs.description,
        'html_url', vs.html_url,
        'thumbnail_url', vs.thumbnail_url,
        'submitted_at', vs.submitted_at,
        'vote_count', (select count(*) from public.viber_votes vv where vv.submission_id = vs.id),
        'i_voted', exists(
          select 1 from public.viber_votes vv
          where vv.submission_id = vs.id and vv.voter_id = auth.uid()
        )
      ) order by p.name
    )
    from public.viber_submissions vs
    join public.profiles p on p.id = vs.student_id
    where vs.iteration_id = p_iteration_id
      and (v_is_admin or p.class = v_class)
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.get_vibers_gallery(uuid) to authenticated;

create or replace function public.vibers_upsert_submission(
  p_iteration_id uuid,
  p_project_title text,
  p_description text,
  p_html_url text,
  p_thumbnail_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.viber_iterations
    where id = p_iteration_id and submission_open = true
  ) then raise exception 'Submission sudah dikunci oleh instruktur'; end if;
  insert into public.viber_submissions (iteration_id, student_id, project_title, description, html_url, thumbnail_url, submitted_at)
  values (p_iteration_id, auth.uid(), p_project_title, coalesce(p_description,''), p_html_url, p_thumbnail_url, now())
  on conflict (iteration_id, student_id) do update set
    project_title = excluded.project_title,
    description   = excluded.description,
    html_url      = case when excluded.html_url is not null then excluded.html_url else viber_submissions.html_url end,
    thumbnail_url = case when excluded.thumbnail_url is not null then excluded.thumbnail_url else viber_submissions.thumbnail_url end,
    submitted_at  = now()
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.vibers_upsert_submission(uuid,text,text,text,text) to authenticated;

create or replace function public.vibers_delete_submission(p_iteration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.viber_iterations
    where id = p_iteration_id and submission_open = true
  ) then raise exception 'Submission sudah dikunci oleh instruktur'; end if;
  delete from public.viber_submissions
  where iteration_id = p_iteration_id and student_id = auth.uid();
end;
$$;
grant execute on function public.vibers_delete_submission(uuid) to authenticated;

create or replace function public.vibers_vote(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_iter_id  uuid; v_owner_id uuid;
  v_voting   boolean; v_end timestamptz; v_votes bigint;
begin
  select s.iteration_id, s.student_id into v_iter_id, v_owner_id
  from public.viber_submissions s where id = p_submission_id;
  select voting_open, voting_end into v_voting, v_end
  from public.viber_iterations where id = v_iter_id;
  if not coalesce(v_voting, false) then raise exception 'Voting belum dibuka'; end if;
  if v_end is not null and v_end < now() then raise exception 'Voting sudah berakhir'; end if;
  if v_owner_id = auth.uid() then raise exception 'Tidak bisa vote karya sendiri'; end if;
  select count(*) into v_votes from public.viber_votes
  where iteration_id = v_iter_id and voter_id = auth.uid();
  if v_votes >= 3 then raise exception 'Batas 3 star sudah tercapai'; end if;
  insert into public.viber_votes (iteration_id, voter_id, submission_id)
  values (v_iter_id, auth.uid(), p_submission_id);
end;
$$;
grant execute on function public.vibers_vote(uuid) to authenticated;

create or replace function public.vibers_unvote(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_iter_id uuid; v_voting boolean; v_end timestamptz;
begin
  select iteration_id into v_iter_id from public.viber_submissions where id = p_submission_id;
  select voting_open, voting_end into v_voting, v_end
  from public.viber_iterations where id = v_iter_id;
  if not coalesce(v_voting, false) then raise exception 'Voting sudah ditutup'; end if;
  if v_end is not null and v_end < now() then raise exception 'Voting sudah berakhir'; end if;
  delete from public.viber_votes
  where submission_id = p_submission_id and voter_id = auth.uid();
end;
$$;
grant execute on function public.vibers_unvote(uuid) to authenticated;

create or replace function public.get_vibers_leaderboard(p_iteration_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_class text; v_is_admin boolean;
begin
  select class, is_admin into v_class, v_is_admin from public.profiles where id = auth.uid();
  if not v_is_admin then
    if not exists (
      select 1 from public.viber_iterations
      where id = p_iteration_id and leaderboard_open = true
    ) then raise exception 'Leaderboard belum dibuka'; end if;
  end if;
  return coalesce((
    with ranked as (
      select
        vs.id          as submission_id,
        vs.student_id,
        p.name         as student_name,
        p.npm          as student_npm,
        (vs.student_id = auth.uid()) as is_me,
        vs.project_title,
        vs.description,
        vs.thumbnail_url,
        count(vv.id)   as vote_count,
        row_number() over (order by count(vv.id) desc, p.name) as rank
      from public.viber_submissions vs
      join public.profiles p on p.id = vs.student_id
      left join public.viber_votes vv on vv.submission_id = vs.id
      where vs.iteration_id = p_iteration_id
        and (v_is_admin or p.class = v_class)
      group by vs.id, vs.student_id, p.name, p.npm
    )
    select jsonb_agg(
      jsonb_build_object(
        'submission_id', submission_id, 'student_id', student_id,
        'student_name', student_name, 'student_npm', student_npm,
        'is_me', is_me, 'project_title', project_title,
        'description', description, 'thumbnail_url', thumbnail_url,
        'vote_count', vote_count, 'rank', rank
      ) order by rank
    )
    from ranked
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.get_vibers_leaderboard(uuid) to authenticated;
