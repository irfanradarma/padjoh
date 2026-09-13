alter table public.sql_case_audit_procedures
  add column if not exists sample_rows jsonb not null default '[]'::jsonb,
  add column if not exists validation_sql text,
  add column if not exists order_sensitive boolean not null default false;

alter table public.sql_case_worksheets
  add column if not exists assignee_id uuid references public.profiles(id),
  add column if not exists assigned_at timestamptz,
  add column if not exists status text not null default 'unassigned',
  add column if not exists validation_feedback jsonb,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists review_feedback text not null default '';

create index if not exists sql_case_worksheets_assignee_idx
  on public.sql_case_worksheets (assignee_id);

update public.sql_case_audit_procedures set
  sample_rows = '[{"activity_date":"2026-08-01","traffic_events":1048,"avg_bytes_sent":198450,"total_bytes_sent":207975600},{"activity_date":"2026-08-02","traffic_events":132,"avg_bytes_sent":184220,"total_bytes_sent":24317040}]'::jsonb,
  validation_sql = $sql$SELECT DATE(captured_at) AS activity_date, COUNT(*) AS traffic_events, ROUND(AVG(bytes_sent), 0) AS avg_bytes_sent, SUM(bytes_sent) AS total_bytes_sent FROM network_traffic GROUP BY DATE(captured_at) ORDER BY activity_date$sql$
where order_num = 1;

update public.sql_case_audit_procedures set
  sample_rows = '[{"activity_hour":9,"traffic_events":1220,"avg_bytes_sent":205100,"total_bytes_sent":250222000},{"activity_hour":13,"traffic_events":1198,"avg_bytes_sent":199870,"total_bytes_sent":239444260}]'::jsonb,
  validation_sql = $sql$SELECT HOUR(captured_at) AS activity_hour, COUNT(*) AS traffic_events, ROUND(AVG(bytes_sent), 0) AS avg_bytes_sent, SUM(bytes_sent) AS total_bytes_sent FROM network_traffic GROUP BY HOUR(captured_at) ORDER BY traffic_events DESC, activity_hour$sql$
where order_num = 2;

update public.sql_case_audit_procedures set
  sample_rows = '[{"activity_date":"2026-08-01","login_status":"FAILED","login_events":12},{"activity_date":"2026-08-01","login_status":"SUCCESS","login_events":86}]'::jsonb,
  validation_sql = $sql$SELECT DATE(attempted_at) AS activity_date, login_status, COUNT(*) AS login_events FROM login_logs GROUP BY DATE(attempted_at), login_status ORDER BY activity_date, login_status$sql$
where order_num = 3;

update public.sql_case_audit_procedures set
  sample_rows = '[{"username":"andi.finance","full_name":"Andi Pratama","asset_tag":"LT-101","hostname":"WKS-ANDI"},{"username":"maya.finance","full_name":"Maya Putri","asset_tag":"LT-102","hostname":"WKS-MAYA"}]'::jsonb,
  validation_sql = $sql$SELECT u.username, u.full_name, a.asset_tag, a.hostname FROM users u JOIN assets a ON a.owner_user_id = u.user_id WHERE u.department = 'Finance' ORDER BY u.username$sql$
where order_num = 4;

update public.sql_case_audit_procedures set
  sample_rows = '[{"source_ip":"198.51.100.20","country_code":"SG","failed_attempts":9,"targeted_users":4},{"source_ip":"192.0.2.18","country_code":"ID","failed_attempts":7,"targeted_users":6}]'::jsonb,
  validation_sql = $sql$SELECT source_ip, country_code, COUNT(*) AS failed_attempts, COUNT(DISTINCT user_id) AS targeted_users FROM login_logs WHERE login_status = 'FAILED' AND source_ip NOT LIKE '10.%' GROUP BY source_ip, country_code HAVING COUNT(*) >= 5 ORDER BY failed_attempts DESC$sql$
where order_num = 5;

update public.sql_case_audit_procedures set
  sample_rows = '[{"login_id":700101,"username":"sample.user","attempted_at":"2026-08-10 22:15:00","source_ip":"198.51.100.24","country_code":"SG"}]'::jsonb,
  validation_sql = $sql$SELECT l.login_id, u.username, l.attempted_at, l.source_ip, l.country_code FROM login_logs l JOIN users u ON u.user_id = l.user_id WHERE l.login_status = 'SUCCESS' AND (TIME(l.attempted_at) < u.work_start OR TIME(l.attempted_at) > u.work_end) ORDER BY l.attempted_at$sql$
where order_num = 6;

update public.sql_case_audit_procedures set
  sample_rows = '[{"login_id":700102,"username":"sample.user","attempted_at":"2026-08-11 21:42:00","source_ip":"203.0.113.40"}]'::jsonb,
  validation_sql = $sql$SELECT l.login_id, u.username, l.attempted_at, l.source_ip FROM login_logs l JOIN users u ON u.user_id = l.user_id WHERE l.login_status = 'SUCCESS' AND l.asset_id IS NULL ORDER BY l.attempted_at$sql$
where order_num = 7;

update public.sql_case_audit_procedures set
  sample_rows = '[{"username":"sample.user","executed_at":"2026-08-11 21:45:00","database_name":"corp_main","target_table":"sample_table","returned_rows":125,"exported":0}]'::jsonb,
  validation_sql = $sql$SELECT u.username, d.executed_at, d.database_name, d.target_table, d.returned_rows, d.exported FROM database_activity d JOIN login_logs l ON l.login_id = d.login_id JOIN users u ON u.user_id = d.user_id WHERE l.source_ip = '203.0.113.77' ORDER BY d.executed_at$sql$
where order_num = 8;

update public.sql_case_audit_procedures set
  sample_rows = '[{"username":"sample.user","export_events":3,"total_rows":2400},{"username":"other.user","export_events":1,"total_rows":850}]'::jsonb,
  validation_sql = $sql$SELECT u.username, COUNT(*) AS export_events, SUM(d.returned_rows) AS total_rows FROM database_activity d JOIN users u ON u.user_id = d.user_id WHERE d.exported = 1 GROUP BY u.username ORDER BY total_rows DESC$sql$
where order_num = 9;

update public.sql_case_audit_procedures set
  sample_rows = '[{"username":"sample.user","captured_at":"2026-08-11 22:05:00","destination_ip":"203.0.113.90","bytes_sent":18000000}]'::jsonb,
  validation_sql = $sql$SELECT u.username, n.captured_at, n.destination_ip, n.bytes_sent FROM network_traffic n JOIN users u ON u.user_id = n.user_id WHERE n.bytes_sent > 10000000 AND n.destination_ip NOT LIKE '10.%' ORDER BY n.bytes_sent DESC$sql$
where order_num = 10;

update public.sql_case_audit_procedures set
  sample_rows = '[{"report_id":101,"opened_at":"2026-08-10 09:20:00","username":"sample.user","report_type":"SECURITY_ALERT","severity":"HIGH","report_status":"OPEN"}]'::jsonb,
  validation_sql = $sql$SELECT r.report_id, r.opened_at, u.username, r.report_type, r.severity, r.report_status FROM incident_reports r JOIN users u ON u.user_id = r.reported_by_user_id ORDER BY r.opened_at$sql$
where order_num = 11;

grant all on public.sql_case_audit_procedures to service_role;
grant all on public.sql_case_worksheets to service_role;
