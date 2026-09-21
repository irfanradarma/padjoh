-- Supports member-based visibility checks used by the CISA submission Edge Function.
create index if not exists cisa_case_submissions_members_gin_idx
  on public.cisa_case_submissions using gin (members jsonb_path_ops);
