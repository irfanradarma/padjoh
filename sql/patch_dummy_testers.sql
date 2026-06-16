-- ============================================================
--  Patch: dummy test accounts — class 4KS-TEST
--  Run once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Register dummy students in whitelist --------------------
insert into public.npm_whitelist (npm, full_name, class) values
  ('TEST001', 'Andi Coba',  '4KS-TEST'),
  ('TEST002', 'Budi Coba',  '4KS-TEST'),
  ('TEST003', 'Cici Coba',  '4KS-TEST'),
  ('TEST004', 'Dodi Coba',  '4KS-TEST'),
  ('TEST005', 'Eni Coba',   '4KS-TEST')
on conflict (npm) do update
  set full_name = excluded.full_name,
      class     = excluded.class;

-- 2) Create auth accounts + email identities (both required for password login)
--    handle_new_user trigger fires automatically → inserts profiles
--
--    Password for all accounts: Test1234!
--    Login NPM: TEST001 … TEST005
--    Login email (internal): TEST001@npm.app … TEST005@npm.app
do $$
declare
  pwd  text   := crypt('Test1234!', gen_salt('bf', 10));
  npms text[] := array['TEST001','TEST002','TEST003','TEST004','TEST005'];
  npm  text;
  uid  uuid;
  eml  text;
begin
  foreach npm in array npms loop
    eml := npm || '@npm.app';

    -- Find existing user or create a new one
    select id into uid from auth.users where email = eml;

    if uid is null then
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
         eml, pwd, now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"email_verified":true}'::jsonb,
         '', '', '', '', '', '',
         now(), now());
    end if;

    -- Ensure email identity exists — required for signInWithPassword to work.
    -- Direct auth.users inserts do NOT create this automatically.
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
