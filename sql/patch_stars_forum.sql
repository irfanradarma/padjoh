-- Run once in: Supabase Dashboard → SQL Editor → New query
-- Adds stars system + forum (posts + comments) with security-definer RPCs.

-- ── Stars ─────────────────────────────────────────────────────
create table if not exists public.stars (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  section_id integer not null check (section_id between 1 and 16),
  count      integer not null default 0 check (count between 0 and 10),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(user_id, section_id)
);
alter table public.stars enable row level security;

-- Admin sets stars for a student
create or replace function public.set_stars(
  p_user_id    uuid,
  p_section_id integer,
  p_count      integer
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.stars(user_id, section_id, count, updated_by, updated_at)
  values (p_user_id, p_section_id, p_count, auth.uid(), now())
  on conflict(user_id, section_id)
  do update set count = p_count, updated_by = auth.uid(), updated_at = now();
end;
$$;

-- Student: own stars for all sections
create or replace function public.get_my_stars()
returns table(section_id integer, count integer)
language sql security definer set search_path = public stable as $$
  select section_id, count from public.stars where user_id = auth.uid();
$$;

-- Admin: all stars for a section
create or replace function public.get_section_stars(p_section_id integer)
returns table(user_id uuid, count integer)
language sql security definer set search_path = public stable as $$
  select user_id, count from public.stars where section_id = p_section_id;
$$;

-- ── Forum ──────────────────────────────────────────────────────
create table if not exists public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  class      text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
alter table public.forum_posts enable row level security;

create table if not exists public.forum_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
alter table public.forum_comments enable row level security;

-- Get posts for a class (with author + comment count)
create or replace function public.get_forum_posts(p_class text)
returns table(
  id uuid, content text, created_at timestamptz,
  author_name text, author_npm text, is_own boolean, comment_count bigint
)
language sql security definer set search_path = public stable as $$
  select fp.id, fp.content, fp.created_at,
    p.name, p.npm,
    (fp.user_id = auth.uid()),
    count(fc.id)
  from public.forum_posts fp
  join public.profiles p on p.id = fp.user_id
  left join public.forum_comments fc on fc.post_id = fp.id
  where fp.class = p_class
  group by fp.id, fp.content, fp.created_at, p.name, p.npm, fp.user_id
  order by fp.created_at desc;
$$;

-- Create a post
create or replace function public.create_forum_post(p_class text, p_content text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.forum_posts(class, user_id, content)
  values (p_class, auth.uid(), p_content)
  returning id into v_id;
  return v_id;
end;
$$;

-- Get comments for a post (with author)
create or replace function public.get_forum_comments(p_post_id uuid)
returns table(
  id uuid, content text, created_at timestamptz,
  author_name text, author_npm text, is_own boolean
)
language sql security definer set search_path = public stable as $$
  select fc.id, fc.content, fc.created_at, p.name, p.npm,
    (fc.user_id = auth.uid())
  from public.forum_comments fc
  join public.profiles p on p.id = fc.user_id
  where fc.post_id = p_post_id
  order by fc.created_at asc;
$$;

-- Add a comment
create or replace function public.add_forum_comment(p_post_id uuid, p_content text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.forum_comments(post_id, user_id, content)
  values (p_post_id, auth.uid(), p_content)
  returning id into v_id;
  return v_id;
end;
$$;

-- Delete post (own or admin)
create or replace function public.delete_forum_post(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.forum_posts
  where id = p_id and (user_id = auth.uid() or public.is_admin());
end;
$$;

-- Delete comment (own or admin)
create or replace function public.delete_forum_comment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.forum_comments
  where id = p_id and (user_id = auth.uid() or public.is_admin());
end;
$$;
