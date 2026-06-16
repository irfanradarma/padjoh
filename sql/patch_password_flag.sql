-- ============================================================
--  Patch: Force password change for students on default password
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Add must_change_password flag — defaults true for all new accounts
alter table public.profiles
  add column if not exists must_change_password boolean not null default true;

-- 2) Admins never see the password-change prompt
update public.profiles
set must_change_password = false
where is_admin = true;

-- 3) Student calls this after successfully updating their password
create or replace function public.mark_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;
grant execute on function public.mark_password_changed() to authenticated;
