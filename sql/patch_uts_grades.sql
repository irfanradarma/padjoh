-- UTS grades imported from "Hasil UTS Audit SI.xlsx", sheet Compiled.
-- Students receive only their own row; class average is calculated server-side.

create table if not exists public.uts_grades (
  npm text primary key,
  pilihan_ganda numeric(6,2) not null,
  esai numeric(6,2) not null,
  nilai numeric(6,2) not null,
  created_at timestamptz not null default now()
);

alter table public.uts_grades enable row level security;
revoke all on public.uts_grades from anon, authenticated;

insert into public.uts_grades (npm, pilihan_ganda, esai, nilai) values
  ('4213250001', 50.0, 40.56, 90.56), ('4213250005', 49.17, 37, 86.17),
  ('4213250007', 50.0, 38.44, 88.44), ('4213250008', 49.17, 37.14, 86.31),
  ('4213250013', 49.17, 37.18, 86.35), ('4213250023', 50.0, 33.84, 83.84),
  ('4213250026', 50.0, 35.56, 85.56), ('4213250034', 47.51, 38.08, 85.59),
  ('4213250048', 45.85, 38.62, 84.47), ('4213250049', 50.0, 37.86, 87.86),
  ('4213250050', 49.17, 39.34, 88.51), ('4213250070', 50.0, 36.82, 86.82),
  ('4213250082', 48.34, 37.18, 85.52), ('4213250083', 50.0, 40.56, 90.56),
  ('4213250093', 50.0, 38.58, 88.58), ('4213250095', 50.0, 38.58, 88.58),
  ('4213250096', 43.36, 35.90, 79.26), ('4213250099', 50.0, 36.10, 86.10),
  ('4213250100', 50.0, 41.28, 91.28), ('4213250111', 50.0, 35.20, 85.20),
  ('4213250115', 50.0, 35.52, 85.52), ('4213250120', 50.0, 38.62, 88.62),
  ('4213250121', 49.17, 36.64, 85.81), ('4213250124', 45.85, 35.16, 81.01),
  ('4213250126', 45.85, 36.28, 82.13), ('4213250127', 50.0, 40.02, 90.02),
  ('4213250129', 49.17, 37.18, 86.35), ('4213250130', 50.0, 36.24, 86.24),
  ('4213250131', 50.0, 38.62, 88.62), ('4213250133', 50.0, 38.04, 88.04),
  ('4213250134', 46.68, 35.56, 82.24), ('4213250135', 43.36, 40.60, 83.96),
  ('4213250136', 49.17, 37.72, 86.89), ('4213250137', 50.0, 39.12, 89.12),
  ('4213250138', 46.68, 37.50, 84.18), ('4213250141', 50.0, 41.28, 91.28),
  ('4213250142', 50.0, 37.00, 87.00), ('4213250143', 45.02, 40.56, 85.58),
  ('4213250146', 46.68, 35.52, 82.20), ('4213250148', 50.0, 37.14, 87.14),
  ('4213250150', 50.0, 39.30, 89.30), ('4213250151', 50.0, 39.16, 89.16),
  ('4213250152', 50.0, 40.02, 90.02), ('4213250173', 50.0, 36.36, 86.36),
  ('4213250174', 50.0, 38.44, 88.44)
on conflict (npm) do update set
  pilihan_ganda = excluded.pilihan_ganda,
  esai = excluded.esai,
  nilai = excluded.nilai;

create or replace function public.get_my_uts_grade()
returns jsonb
language plpgsql security definer set search_path = public
stable as $$
declare
  v_npm text;
  v_class text;
  v_grade public.uts_grades%rowtype;
  v_class_average numeric;
begin
  select p.npm, p.class into v_npm, v_class
  from public.profiles p where p.id = auth.uid();

  select g.* into v_grade from public.uts_grades g where g.npm = v_npm;
  if not found then return null; end if;

  select round(avg(g.nilai), 2) into v_class_average
  from public.uts_grades g
  join public.profiles p on p.npm = g.npm
  where p.class = v_class;

  return jsonb_build_object(
    'nilai', v_grade.nilai,
    'pilihan_ganda', v_grade.pilihan_ganda,
    'esai', v_grade.esai,
    'rata_rata_kelas', v_class_average
  );
end;
$$;

revoke all on function public.get_my_uts_grade() from public, anon;
grant execute on function public.get_my_uts_grade() to authenticated;
