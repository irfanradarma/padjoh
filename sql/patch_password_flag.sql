-- ============================================================
--  Patch: Force password change for students on default password
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Add must_change_password flag — default false agar user lama tidak terganggu
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- 2) Deteksi otomatis: tandai hanya yang MASIH pakai password default PKNstan2025!
--    (bcrypt verify: crypt(password, stored_hash) == stored_hash jika cocok)
update public.profiles p
set must_change_password = true
from auth.users u
where u.id = p.id
  and p.is_admin = false
  and u.encrypted_password = crypt('PKNstan2025!', u.encrypted_password);

-- 3) Pastikan admin tidak pernah kena flag
update public.profiles
set must_change_password = false
where is_admin = true;

-- 4) Fungsi untuk student hapus flag setelah berhasil ganti password
create or replace function public.mark_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;
grant execute on function public.mark_password_changed() to authenticated;
