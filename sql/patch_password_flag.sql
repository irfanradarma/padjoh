-- ============================================================
--  Patch: Force password change for students on default password
--  Run in: Supabase Dashboard → SQL Editor → New query
--  Safe to re-run — idempotent
-- ============================================================

-- 1) Add column if not exists (skip if already there)
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- 2) Reset semua ke false dulu (koreksi jika versi lama sudah set semua ke true)
update public.profiles
set must_change_password = false;

-- 3) Tandai HANYA yang masih pakai password default PKNstan2025!
--    bcrypt verify: crypt(password, stored_hash) == stored_hash jika cocok
update public.profiles p
set must_change_password = true
from auth.users u
where u.id = p.id
  and p.is_admin = false
  and u.encrypted_password = crypt('PKNstan2025!', u.encrypted_password);

-- 4) Fungsi untuk student hapus flag setelah berhasil ganti password
create or replace function public.mark_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;
grant execute on function public.mark_password_changed() to authenticated;
