-- ============================================================
--  Patch: Quiz Realtime fix + session status RPC
--  Run AFTER patch_quiz.sql and patch_quiz_submit.sql
-- ============================================================

-- 1) Allow students to SELECT their own quiz session so Supabase Realtime
--    can deliver postgres_changes events to them.
--    Without a SELECT policy, RLS blocks the realtime event even though
--    the table is in the publication.
drop policy if exists "read_own_quiz_session" on public.quiz_sessions;
create policy "read_own_quiz_session" on public.quiz_sessions
  for select to authenticated
  using (
    -- admins see all
    (select is_admin from public.profiles where id = auth.uid())
    or
    -- students see only sessions they are checked into
    exists (
      select 1 from public.quiz_checkins
      where session_id = quiz_sessions.id and user_id = auth.uid()
    )
  );

-- 2) Lightweight RPC for lobby polling (called every 3 s by checked-in student)
create or replace function public.get_quiz_session_info(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  -- Only checked-in students or admins
  if not (select is_admin from public.profiles where id = auth.uid()) then
    if not exists (
      select 1 from public.quiz_checkins
      where session_id = p_session_id and user_id = auth.uid()
    ) then raise exception 'Unauthorized'; end if;
  end if;

  return (
    select jsonb_build_object('status', qs.status, 'started_at', qs.started_at)
    from public.quiz_sessions qs
    where qs.id = p_session_id
  );
end;
$$;
grant execute on function public.get_quiz_session_info(uuid) to authenticated;
