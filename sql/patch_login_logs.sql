-- ============================================================
--  Patch: Login Logs
--  Admin RPC to view login/logout history from auth.audit_log_entries
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create or replace function public.admin_get_login_logs(p_limit int default 300)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  return (
    select coalesce(jsonb_agg(row_data), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id',         a.id,
        'created_at', a.created_at,
        'ip_address', a.ip_address,
        'action',     a.payload->>'action',
        'actor_id',   a.payload->>'actor_id',
        'name',       p.name,
        'npm',        p.npm,
        'class',      p.class
      ) as row_data
      from auth.audit_log_entries a
      left join public.profiles p
        on p.id = (a.payload->>'actor_id')::uuid
      where
        a.payload->>'action' in ('login', 'logout')
        and (a.payload->>'actor_id') ~ '^[0-9a-f-]{36}$'
      order by a.created_at desc
      limit p_limit
    ) sub
  );
end;
$$;
grant execute on function public.admin_get_login_logs(int) to authenticated;
