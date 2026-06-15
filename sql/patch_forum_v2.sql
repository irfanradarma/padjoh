-- ============================================================
--  Patch: Forum v2 — global, votes, threaded replies, anon
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Add is_anon + parent_id to existing forum_posts
alter table public.forum_posts
  add column if not exists is_anon   boolean not null default false,
  add column if not exists parent_id uuid references public.forum_posts(id) on delete cascade;

-- 2) Votes table
create table if not exists public.forum_votes (
  post_id uuid     not null references public.forum_posts(id) on delete cascade,
  user_id uuid     not null references auth.users(id)          on delete cascade,
  vote    smallint not null check (vote in (1, -1)),
  primary key (post_id, user_id)
);
alter table public.forum_votes enable row level security;
grant all on public.forum_votes to service_role;

drop policy if exists "forum_votes_read"   on public.forum_votes;
drop policy if exists "forum_votes_insert" on public.forum_votes;
drop policy if exists "forum_votes_update" on public.forum_votes;
drop policy if exists "forum_votes_delete" on public.forum_votes;

create policy "forum_votes_read"   on public.forum_votes for select to authenticated using (true);
create policy "forum_votes_insert" on public.forum_votes for insert to authenticated with check (user_id = auth.uid());
create policy "forum_votes_update" on public.forum_votes for update to authenticated using (user_id = auth.uid());
create policy "forum_votes_delete" on public.forum_votes for delete to authenticated using (user_id = auth.uid());

-- 3) Get top-level posts (global — no class filter)
create or replace function public.get_forum_posts_v2()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',           fp.id,
        'content',      fp.content,
        'created_at',   fp.created_at,
        'is_anon',      fp.is_anon,
        'author_name',  case when fp.is_anon and fp.user_id <> auth.uid()
                          then 'Anonim' else pr.name end,
        'author_npm',   case when fp.is_anon and fp.user_id <> auth.uid()
                          then null else pr.npm end,
        'author_class', case when fp.is_anon and fp.user_id <> auth.uid()
                          then null else pr.class end,
        'is_own',       fp.user_id = auth.uid(),
        'vote_sum',     coalesce(vs.vote_sum, 0),
        'my_vote',      mv.vote,
        'reply_count',  coalesce(rc.cnt, 0)
      )
      order by coalesce(vs.vote_sum, 0) desc, fp.created_at desc
    ), '[]'::jsonb)
    from public.forum_posts fp
    join public.profiles pr on pr.id = fp.user_id
    left join (
      select post_id, sum(vote)::integer as vote_sum
      from public.forum_votes group by post_id
    ) vs on vs.post_id = fp.id
    left join (
      select post_id, vote from public.forum_votes where user_id = auth.uid()
    ) mv on mv.post_id = fp.id
    left join (
      select parent_id, count(*)::integer as cnt
      from public.forum_posts where parent_id is not null
      group by parent_id
    ) rc on rc.parent_id = fp.id
    where fp.parent_id is null
  );
end;
$$;
grant execute on function public.get_forum_posts_v2() to authenticated;

-- 4) Get replies to a post
create or replace function public.get_forum_replies(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',           fp.id,
        'content',      fp.content,
        'created_at',   fp.created_at,
        'is_anon',      fp.is_anon,
        'parent_id',    fp.parent_id,
        'author_name',  case when fp.is_anon and fp.user_id <> auth.uid()
                          then 'Anonim' else pr.name end,
        'author_npm',   case when fp.is_anon and fp.user_id <> auth.uid()
                          then null else pr.npm end,
        'author_class', case when fp.is_anon and fp.user_id <> auth.uid()
                          then null else pr.class end,
        'is_own',       fp.user_id = auth.uid(),
        'vote_sum',     coalesce(vs.vote_sum, 0),
        'my_vote',      mv.vote
      )
      order by fp.created_at asc
    ), '[]'::jsonb)
    from public.forum_posts fp
    join public.profiles pr on pr.id = fp.user_id
    left join (
      select post_id, sum(vote)::integer as vote_sum
      from public.forum_votes group by post_id
    ) vs on vs.post_id = fp.id
    left join (
      select post_id, vote from public.forum_votes where user_id = auth.uid()
    ) mv on mv.post_id = fp.id
    where fp.parent_id = p_post_id
  );
end;
$$;
grant execute on function public.get_forum_replies(uuid) to authenticated;

-- 5) Create post or reply (v2: supports is_anon + parent_id)
create or replace function public.create_forum_post_v2(
  p_content   text,
  p_is_anon   boolean default false,
  p_parent_id uuid    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.forum_posts(class, user_id, content, is_anon, parent_id)
  values (
    (select class from public.profiles where id = auth.uid()),
    auth.uid(), p_content, p_is_anon, p_parent_id
  )
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_forum_post_v2(text, boolean, uuid) to authenticated;

-- 6) Vote on a post (p_vote 1 = up, -1 = down, 0 = remove)
create or replace function public.vote_forum_post(p_post_id uuid, p_vote integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_vote = 0 then
    delete from public.forum_votes where post_id = p_post_id and user_id = auth.uid();
  else
    insert into public.forum_votes(post_id, user_id, vote)
    values (p_post_id, auth.uid(), p_vote::smallint)
    on conflict(post_id, user_id) do update set vote = excluded.vote;
  end if;
end;
$$;
grant execute on function public.vote_forum_post(uuid, integer) to authenticated;
