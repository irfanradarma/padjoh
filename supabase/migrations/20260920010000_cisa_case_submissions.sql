create extension if not exists pgcrypto;

create table if not exists public.cisa_case_submissions (
  id uuid primary key default gen_random_uuid(),
  round smallint not null check (round in (1, 2)),
  class_name text not null check (class_name in ('Audit-2', 'Audit-BL')),
  team_key text not null,
  members jsonb not null check (jsonb_typeof(members) = 'array' and jsonb_array_length(members) between 2 and 3),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  uploaded_by uuid not null references public.profiles(id),
  exported_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  graded_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'graded', 'grading_failed')),
  assessment jsonb,
  grading_error text
);

create index if not exists cisa_case_submissions_class_round_idx
  on public.cisa_case_submissions (class_name, round, uploaded_at desc);
create index if not exists cisa_case_submissions_team_idx
  on public.cisa_case_submissions (team_key, round, uploaded_at desc);

alter table public.cisa_case_submissions enable row level security;
revoke all on public.cisa_case_submissions from anon, authenticated;
grant all on public.cisa_case_submissions to service_role;
