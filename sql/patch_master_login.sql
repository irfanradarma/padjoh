-- ============================================================
--  Patch: Super Login — one master password for all students
--  Also fixes hook_check_npm_whitelist for sign-in compatibility.
--
--  After running this, log in as any student using:
--    NPM  : any npm from npm_whitelist (e.g. 4213250083)
--    PW   : PKNstan2025!
--
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Fix hook so it doesn't block sign-in events ---------------
create or replace function public.hook_check_npm_whitelist(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := event->'user'->>'email';
  v_npm    text;
  v_domain text;
begin
  -- Custom Access Token and other non-signup events don't carry
  -- user.email — pass them through without restriction.
  if v_email is null then
    return '{}'::jsonb;
  end if;

  v_npm    := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  if lower(v_domain) <> 'npm.app' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Invalid account domain.'));
  end if;

  if not exists (select 1 from public.npm_whitelist where npm = v_npm) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'This NPM is not authorized to register.'));
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_check_npm_whitelist(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_check_npm_whitelist(jsonb) from anon, authenticated, public;

-- 2) Create / update all student accounts to master password ---
--    Existing accounts: password overwritten to master password.
--    New accounts: created with master password + email identity.
do $$
declare
  master_pwd text := crypt('PKNstan2025!', gen_salt('bf', 10));
  w          record;
  uid        uuid;
  eml        text;
begin
  for w in (select npm from public.npm_whitelist where class <> 'admin') loop
    eml := w.npm || '@npm.app';

    select id into uid from auth.users where email = eml;

    if uid is null then
      -- New account: insert into auth.users (triggers handle_new_user → profile)
      uid := gen_random_uuid();
      insert into auth.users
        (id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change_token_new,
         email_change, email_change_token_current, phone_change,
         created_at, updated_at)
      values
        (uid, '00000000-0000-0000-0000-000000000000',
         'authenticated', 'authenticated',
         eml, master_pwd, now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"email_verified":true}'::jsonb,
         '', '', '', '', '', '',
         now(), now());
    else
      -- Existing account: reset to master password
      update auth.users
      set encrypted_password = master_pwd, updated_at = now()
      where id = uid;
    end if;

    -- Ensure email identity exists (required for signInWithPassword)
    if not exists (
      select 1 from auth.identities where provider_id = eml and provider = 'email'
    ) then
      insert into auth.identities
        (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
      values
        (gen_random_uuid(), eml, uid,
         jsonb_build_object('sub', uid::text, 'email', eml),
         'email', now(), now());
    end if;
  end loop;
end;
$$;
