-- ============================================================
--  Patch: make hook_check_npm_whitelist defensive
--  Fixes: "Database error querying schema" on sign-in when the
--  hook is registered as Custom Access Token (different event format)
--  Run once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

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
  -- Custom Access Token events don't include user.email — pass them through.
  -- This hook only needs to act on Before-User-Created events.
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
