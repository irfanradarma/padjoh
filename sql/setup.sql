-- ============================================================
--  NPM Auth — Supabase setup
--  Run this ENTIRE script once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Whitelist of NPMs allowed to register / sign in -----------------
create table if not exists public.npm_whitelist (
  npm        text primary key,
  full_name  text,
  created_at timestamptz not null default now()
);

-- 2) One profile row per registered user (1:1 with auth.users) --------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  npm        text unique not null,
  created_at timestamptz not null default now()
);

-- 3) Row Level Security ----------------------------------------------
alter table public.npm_whitelist enable row level security;
alter table public.profiles      enable row level security;

-- npm_whitelist: RLS on + NO policies = nobody can read it from the
-- client. Only the SECURITY DEFINER functions below may touch it.

-- profiles: a signed-in user may read / update ONLY their own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 4) Auto-create a profile whenever a user is created ----------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, npm)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Before-User-Created hook: only whitelisted NPMs may sign up -----
--    The app sends emails shaped like  <npm>@npm.app
--    >>> If you change the domain here, change VITE_NPM_EMAIL_DOMAIN too. <<<
create or replace function public.hook_check_npm_whitelist(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := event->'user'->>'email';
  v_npm    text := split_part(v_email, '@', 1);
  v_domain text := split_part(v_email, '@', 2);
begin
  if lower(v_domain) <> 'npm.app' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Invalid account domain.'));
  end if;

  if not exists (select 1 from public.npm_whitelist w where w.npm = v_npm) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'This NPM is not authorized to register.'));
  end if;

  return '{}'::jsonb;   -- empty object => allow the signup
end;
$$;

grant execute on function public.hook_check_npm_whitelist(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_check_npm_whitelist(jsonb) from anon, authenticated, public;

-- 6) Status check used by the first screen ---------------------------
--    Returns one of: 'not_whitelisted' | 'unregistered' | 'registered'
create or replace function public.npm_login_status(p_npm text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.npm_whitelist where npm = p_npm) then
    return 'not_whitelisted';
  end if;
  if exists (select 1 from public.profiles where npm = p_npm) then
    return 'registered';
  end if;
  return 'unregistered';
end;
$$;

grant execute on function public.npm_login_status(text) to anon, authenticated;

-- 7) Seed a couple of NPMs so you can test immediately ----------------
insert into public.npm_whitelist (npm, full_name) values
  ('1234567890', 'Test Student One'),
  ('2222222222', 'Test Student Two')
on conflict (npm) do nothing;

-- To add more later:
--   insert into public.npm_whitelist (npm, full_name) values ('0011223344', 'Name');
