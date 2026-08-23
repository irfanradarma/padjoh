-- Fix admin_reset_password: pgcrypto functions live in the extensions schema
-- on Supabase and must be schema-qualified when search_path excludes it.

create or replace function public.admin_reset_password(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(
        'PKNstan2025!', extensions.gen_salt('bf', 10)
      ),
      updated_at = now()
  where id = p_user_id;

  update public.profiles
  set must_change_password = true
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_reset_password(uuid) to authenticated;
