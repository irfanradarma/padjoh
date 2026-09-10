create extension if not exists pgcrypto;

create table if not exists public.sql_assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  database_name text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  due_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.sql_assignment_tasks (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.sql_assignments(id) on delete cascade,
  position integer not null default 1, title text not null, instruction text not null,
  starter_sql text not null default '', sample_output text not null default '',
  order_matters boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.sql_task_solutions (
  task_id uuid primary key references public.sql_assignment_tasks(id) on delete cascade,
  solution_sql text not null
);
create table if not exists public.sql_task_attempts (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.sql_assignment_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, submitted_sql text not null,
  passed boolean not null, feedback text, created_at timestamptz not null default now()
);
create table if not exists public.sql_task_progress (
  task_id uuid not null references public.sql_assignment_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(), completed_sql text not null,
  primary key(task_id,user_id)
);
create index if not exists sql_tasks_assignment_idx on public.sql_assignment_tasks(assignment_id,position);
create index if not exists sql_attempts_user_idx on public.sql_task_attempts(user_id,created_at desc);

alter table public.sql_assignments enable row level security;
alter table public.sql_assignment_tasks enable row level security;
alter table public.sql_task_solutions enable row level security;
alter table public.sql_task_attempts enable row level security;
alter table public.sql_task_progress enable row level security;
drop policy if exists sql_assignments_read on public.sql_assignments;
create policy sql_assignments_read on public.sql_assignments for select to authenticated using(status='published' or public.is_admin());
drop policy if exists sql_tasks_read on public.sql_assignment_tasks;
create policy sql_tasks_read on public.sql_assignment_tasks for select to authenticated using(public.is_admin() or exists(select 1 from public.sql_assignments a where a.id=assignment_id and a.status='published'));
drop policy if exists sql_progress_read on public.sql_task_progress;
create policy sql_progress_read on public.sql_task_progress for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists sql_attempts_read on public.sql_task_attempts;
create policy sql_attempts_read on public.sql_task_attempts for select to authenticated using(user_id=auth.uid() or public.is_admin());

insert into public.sql_assignments(id,title,description,database_name,status,due_at)
values('10000000-0000-4000-8000-000000000001','Sales Database Challenge','Latihan SQL bertahap menggunakan data penjualan pada database latihan1. Selesaikan setiap tugas dengan query yang menghasilkan data tepat.','latihan1','published',null)
on conflict(id) do update set title=excluded.title,description=excluded.description,database_name=excluded.database_name,status=excluded.status;

insert into public.sql_assignment_tasks(id,assignment_id,position,title,instruction,starter_sql,sample_output,order_matters) values
('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'Daftar pelanggan pertama','Tampilkan kode dan nama lima pelanggan pertama. Urutkan berdasarkan kode pelanggan.','SELECT ','Kolom: kode_plg, nama_plg',true),
('11000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',2,'Jumlah pelanggan','Hitung seluruh pelanggan dan beri nama kolom hasilnya total_customer.','SELECT COUNT(*) AS total_customer','total_customer: satu angka',false),
('11000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',3,'Order berdasarkan jenis','Hitung jumlah delivery order untuk setiap jenis_sales. Tampilkan jenis_sales dan jumlah_order, lalu urutkan berdasarkan jenis_sales.','SELECT ','Kolom: jenis_sales, jumlah_order',true),
('11000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',4,'Lima penjualan terbesar','Tampilkan no_do dan total_sales untuk lima delivery order dengan total terbesar. Gunakan no_do sebagai urutan kedua secara menaik.','SELECT ','Kolom: no_do, total_sales; 5 baris',true),
('11000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',5,'Pelanggan paling aktif','Gabungkan customer_master dan deliveryorder_master. Tampilkan lima pelanggan dengan order terbanyak sebagai nama_plg dan jumlah_order.','SELECT ','Kolom: nama_plg, jumlah_order; 5 baris',true),
('11000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',6,'Produk terlaris','Gabungkan produk_master dan sales_detail. Tampilkan lima produk dengan total quantity terbesar sebagai nama_produk dan total_quantity.','SELECT ','Kolom: nama_produk, total_quantity; 5 baris',true)
on conflict(id) do update set title=excluded.title,instruction=excluded.instruction,starter_sql=excluded.starter_sql,sample_output=excluded.sample_output,order_matters=excluded.order_matters;

insert into public.sql_task_solutions(task_id,solution_sql) values
('11000000-0000-4000-8000-000000000001','SELECT kode_plg, nama_plg FROM customer_master ORDER BY kode_plg LIMIT 5'),
('11000000-0000-4000-8000-000000000002','SELECT COUNT(*) AS total_customer FROM customer_master'),
('11000000-0000-4000-8000-000000000003','SELECT jenis_sales, COUNT(*) AS jumlah_order FROM deliveryorder_master GROUP BY jenis_sales ORDER BY jenis_sales'),
('11000000-0000-4000-8000-000000000004','SELECT no_do, total_sales FROM deliveryorder_master ORDER BY total_sales DESC, no_do ASC LIMIT 5'),
('11000000-0000-4000-8000-000000000005','SELECT c.nama_plg, COUNT(d.no_do) AS jumlah_order FROM customer_master c JOIN deliveryorder_master d ON d.kode_plg=c.kode_plg GROUP BY c.kode_plg,c.nama_plg ORDER BY jumlah_order DESC,c.nama_plg LIMIT 5'),
('11000000-0000-4000-8000-000000000006','SELECT p.nama_produk, SUM(s.quantity) AS total_quantity FROM produk_master p JOIN sales_detail s ON s.kode_produk=p.kode_produk GROUP BY p.kode_produk,p.nama_produk ORDER BY total_quantity DESC,p.nama_produk LIMIT 5')
on conflict(task_id) do update set solution_sql=excluded.solution_sql;
