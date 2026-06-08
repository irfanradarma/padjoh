-- ============================================================
--  Patch: add class column, insert students & admin
--  Run once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Add class column to whitelist and profiles -------------------
alter table public.npm_whitelist
  add column if not exists class text;

alter table public.profiles
  add column if not exists name     text,
  add column if not exists class    text,
  add column if not exists is_admin boolean not null default false;

-- 2) Update trigger so new profiles inherit name, class, is_admin -
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_npm     text := split_part(new.email, '@', 1);
  v_name    text;
  v_class   text;
  v_isadmin boolean;
begin
  select full_name, class, (class = 'admin')
  into v_name, v_class, v_isadmin
  from public.npm_whitelist
  where npm = v_npm;

  insert into public.profiles (id, npm, name, class, is_admin)
  values (new.id, v_npm, v_name, v_class, coalesce(v_isadmin, false));
  return new;
end;
$$;

-- 3) Admin account -----------------------------------------------
insert into public.npm_whitelist (npm, full_name, class) values
  ('superadmin', 'Administrator', 'admin')
on conflict (npm) do update
  set full_name = excluded.full_name,
      class     = excluded.class;

-- 4) Audit-2 students --------------------------------------------
insert into public.npm_whitelist (npm, full_name, class) values
  ('4213250083', 'ADINDA NOOR WIDOWATI',                  'Audit-2'),
  ('4213250115', 'ADITA QUEENOLA LARASATI',               'Audit-2'),
  ('4213250082', 'ADREW MARCELO PUTRA',                   'Audit-2'),
  ('4213250005', 'AFIFAH PAWESTRI',                       'Audit-2'),
  ('4213250013', 'ALFITRA PUTRI DESHANDA',                'Audit-2'),
  ('4213250121', 'ARDELIA SALSABILA PUSPITAHATI',         'Audit-2'),
  ('4213250008', 'ARINDYA MIFTAH AYU RAHMA',              'Audit-2'),
  ('4213250124', 'AULIA RIZKI ANNASTYA',                  'Audit-2'),
  ('4213250111', 'AYU SAVITRI WULANDARI',                 'Audit-2'),
  ('4213250048', 'BHASKARA ADRIAN NOVARI OLGA',           'Audit-2'),
  ('4213250100', 'BHIMA FITRA RAMADHIKA',                 'Audit-2'),
  ('4213250023', 'CALVIN JEREMY',                         'Audit-2'),
  ('4213250001', 'DENIA KHAERUNISSA',                     'Audit-2'),
  ('4213250034', 'ERLIANA FIRDHA AMALIA UTOMO',           'Audit-2'),
  ('4213250099', 'FADEL ZAIDAN ATHALLAH',                 'Audit-2'),
  ('4213250093', 'FARHAN NURMUSTAQIM',                    'Audit-2'),
  ('4213250095', 'MAESYA PUTRINA SITEPU',                 'Audit-2'),
  ('4213250070', 'MARUDUT RIZKY MARTIN PURBA',            'Audit-2'),
  ('4213250007', 'MUHAMMAD FAISHAL AMMAR',                'Audit-2'),
  ('4213250050', 'RATRI NUR ALFIANTI',                    'Audit-2'),
  ('4213250096', 'RYZKY MAULANA HAKIM',                   'Audit-2'),
  ('4213250049', 'SUKMAWATY SIAHAAN',                     'Audit-2'),
  ('4213250173', 'WINDA RYZKA AULIA RAHMANINGRUM',        'Audit-2'),
  ('4213250174', 'YESSI VIONICA SIMANJUNTAK',             'Audit-2'),
  ('4213250120', 'YUDHISTIRA ATHASYUR ROSSONERO',         'Audit-2'),
  ('4213250026', 'YUNIDA RAHMADHANI',                     'Audit-2')
on conflict (npm) do update
  set full_name = excluded.full_name,
      class     = excluded.class;

-- 5) Audit-BL students -------------------------------------------
insert into public.npm_whitelist (npm, full_name, class) values
  ('4213250127', 'ARIELLA DINA ARASANI',                  'Audit-BL'),
  ('4213250135', 'ATAHILAH RESTU ILAHI',                  'Audit-BL'),
  ('4213250129', 'AYODHYA AGTI FIRDAUSA',                 'Audit-BL'),
  ('4213250126', 'AYU MILA DEWATI',                       'Audit-BL'),
  ('4213250130', 'CLEMENTINE THERESIA SKANIA PASARIBU',   'Audit-BL'),
  ('4213250138', 'DARY RASYADI MUFID',                    'Audit-BL'),
  ('4213250133', 'HAMZAH AKBAR SILALAHI',                 'Audit-BL'),
  ('4213250137', 'INTAN CAHYA OKTAVIANA',                 'Audit-BL'),
  ('4213250131', 'KANA SATYARANI',                        'Audit-BL'),
  ('4213250151', 'KELVIN FEBRIANSYAH PRATAMA',            'Audit-BL'),
  ('4213250148', 'LUTFIYA TUSSIFAH',                      'Audit-BL'),
  ('4213250136', 'M. OCRYAN BAROKAH',                     'Audit-BL'),
  ('4213250152', 'MUHAMMAD ILHAM DARMAWAN',               'Audit-BL'),
  ('4213250150', 'NUR ACHMAD TAUFIQ',                     'Audit-BL'),
  ('4213250134', 'PRITA ULI TOBING',                      'Audit-BL'),
  ('4213250141', 'PURBORANI SOFIKA RAMADHANI',            'Audit-BL'),
  ('4213250146', 'PUTRA JAYA BUKIT',                      'Audit-BL'),
  ('4213250143', 'RISKI PAULINA',                         'Audit-BL'),
  ('4213250142', 'RIVAL TOGA SITORUS',                    'Audit-BL')
on conflict (npm) do update
  set full_name = excluded.full_name,
      class     = excluded.class;
