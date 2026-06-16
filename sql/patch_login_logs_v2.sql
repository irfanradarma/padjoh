-- ============================================================
--  Patch: Login Logs v2
--  auth.audit_log_entries kosong di plan ini — pakai tabel custom
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Hapus fungsi lama yang pakai auth.audit_log_entries
drop function if exists public.admin_get_login_logs(int);

-- Tabel custom untuk menyimpan log login
create table if not exists public.login_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

-- Blok akses langsung; fungsi SECURITY DEFINER bypass RLS
alter table public.login_logs enable row level security;

-- RPC: dipanggil dari client saat event SIGNED_IN
create or replace function public.log_my_login()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_headers jsonb;
  v_ip      text;
  v_ua      text;
begin
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
    v_ip := coalesce(
      v_headers->>'x-forwarded-for',
      v_headers->>'x-real-ip'
    );
    if v_ip like '%,%' then
      v_ip := trim(split_part(v_ip, ',', 1));
    end if;
    v_ua := v_headers->>'user-agent';
  exception when others then
    v_ip := null; v_ua := null;
  end;
  insert into public.login_logs (user_id, ip_address, user_agent)
  values (auth.uid(), v_ip, v_ua);
end;
$$;
grant execute on function public.log_my_login() to authenticated;

-- RPC: admin baca log login
create or replace function public.admin_get_login_logs(p_limit int default 300)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id',         l.id,
        'created_at', l.created_at,
        'ip_address', l.ip_address,
        'user_agent', l.user_agent,
        'action',     'login',
        'name',       p.name,
        'npm',        p.npm,
        'class',      p.class
      ) as row_data
      from public.login_logs l
      join public.profiles p on p.id = l.user_id
      order by l.created_at desc
      limit p_limit
    ) sub
  );
end;
$$;
grant execute on function public.admin_get_login_logs(int) to authenticated;
