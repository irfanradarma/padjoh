-- ============================================================
--  Patch: Forum v3 — image & link media support
--  Run in: Supabase Dashboard → SQL Editor → New query
--  NOTE: Run patch_forum_v2.sql first if not yet applied.
-- ============================================================

-- 1) Add media columns to forum_posts
alter table public.forum_posts
  add column if not exists image_url text,
  add column if not exists link_url  text;

-- 2) Storage bucket for forum images (public, 5 MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forum', 'forum', true, 5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- 3) Storage RLS policies
drop policy if exists "forum images public read" on storage.objects;
drop policy if exists "forum images auth upload" on storage.objects;

create policy "forum images public read" on storage.objects
  for select using (bucket_id = 'forum');

create policy "forum images auth upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'forum');

-- 4) Update get_forum_posts_v2 to return image_url + link_url
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
        'image_url',    fp.image_url,
        'link_url',     fp.link_url,
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

-- 5) Update get_forum_replies to return image_url + link_url
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
        'image_url',    fp.image_url,
        'link_url',     fp.link_url,
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

-- 6) Replace create_forum_post_v2 with image_url + link_url support
--    Drop old 3-param signature first (can't alter param list in-place)
drop function if exists public.create_forum_post_v2(text, boolean, uuid);

create or replace function public.create_forum_post_v2(
  p_content   text,
  p_is_anon   boolean default false,
  p_parent_id uuid    default null,
  p_image_url text    default null,
  p_link_url  text    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.forum_posts(class, user_id, content, is_anon, parent_id, image_url, link_url)
  values (
    (select class from public.profiles where id = auth.uid()),
    auth.uid(), p_content, p_is_anon, p_parent_id, p_image_url, p_link_url
  )
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_forum_post_v2(text, boolean, uuid, text, text) to authenticated;
