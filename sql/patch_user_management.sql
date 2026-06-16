-- ============================================================
--  Patch: User Management
--  1) Fix get_my_profile to include must_change_password
--  2) Admin RPCs: list, create, update, delete users + reset pw
--
--  Run AFTER patch_password_flag.sql
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) get_my_profile — updated to expose must_change_password
--    (column added in patch_password_flag.sql)
create or replace function public.get_my_profile()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'id',                   id,
    'npm',                  npm,
    'name',                 name,
    'class',                class,
    'is_admin',             is_admin,
    'must_change_password', coalesce(must_change_password, false)
  )
  from public.profiles
  where id = auth.uid()
  limit 1
$$;
grant execute on function public.get_my_profile() to authenticated;

-- 2) Admin: list all users
create or replace function public.admin_get_all_users()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',                   p.id,
        'npm',                  p.npm,
        'name',                 p.name,
        'class',                p.class,
        'is_admin',             p.is_admin,
        'must_change_password', coalesce(p.must_change_password, false),
        'created_at',           p.created_at
      ) order by p.is_admin desc, p.class, p.name
    ), '[]'::jsonb)
    from public.profiles p
  );
end;
$$;
grant execute on function public.admin_get_all_users() to authenticated;

-- 3) Admin: update a user's profile
create or replace function public.admin_update_user(
  p_user_id  uuid,
  p_name     text,
  p_npm      text,
  p_class    text,
  p_is_admin boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  update public.profiles
  set name = p_name, npm = p_npm, class = p_class, is_admin = p_is_admin
  where id = p_user_id;
  -- Keep npm_whitelist in sync
  update public.npm_whitelist
  set full_name = p_name, class = p_class
  where npm = p_npm;
end;
$$;
grant execute on function public.admin_update_user(uuid, text, text, text, boolean) to authenticated;

-- 4) Admin: delete a user (cascades to profiles + all data via FK)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Tidak dapat menghapus akun sendiri';
  end if;
  delete from auth.users where id = p_user_id;
end;
$$;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 5) Admin: create a new user (default password: PKNstan2025!)
create or replace function public.admin_create_user(
  p_name     text,
  p_npm      text,
  p_class    text,
  p_is_admin boolean default false
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := gen_random_uuid();
  v_eml text := p_npm || '@npm.app';
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  if exists (select 1 from auth.users where email = v_eml) then
    raise exception 'User dengan NPM ini sudah ada';
  end if;

  -- Whitelist first — trigger reads this to set name/class on new profile
  insert into public.npm_whitelist (npm, full_name, class)
  values (p_npm, p_name, case when p_is_admin then 'admin' else p_class end)
  on conflict (npm) do update set full_name = p_name, class = excluded.class;

  -- Insert into auth.users (triggers handle_new_user → creates profile row)
  insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password,
     email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
     confirmation_token, recovery_token, email_change_token_new,
     email_change, email_change_token_current, phone_change,
     created_at, updated_at)
  values
    (v_uid, '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated',
     v_eml, crypt('PKNstan2025!', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"email_verified":true}'::jsonb,
     '', '', '', '', '', '',
     now(), now());

  -- Email identity (required for signInWithPassword)
  insert into auth.identities
    (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values
    (gen_random_uuid(), v_eml, v_uid,
     jsonb_build_object('sub', v_uid::text, 'email', v_eml),
     'email', now(), now());

  -- Override is_admin (trigger sets it from class; this ensures explicit control)
  update public.profiles
  set is_admin             = p_is_admin,
      class                = case when p_is_admin then 'admin' else p_class end,
      must_change_password = true
  where id = v_uid;

  return v_uid;
end;
$$;
grant execute on function public.admin_create_user(text, text, text, boolean) to authenticated;

-- 6) Admin: reset a user's password to default
create or replace function public.admin_reset_password(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  update auth.users
  set encrypted_password = crypt('PKNstan2025!', gen_salt('bf', 10)),
      updated_at         = now()
  where id = p_user_id;
  update public.profiles
  set must_change_password = true
  where id = p_user_id;
end;
$$;
grant execute on function public.admin_reset_password(uuid) to authenticated;
