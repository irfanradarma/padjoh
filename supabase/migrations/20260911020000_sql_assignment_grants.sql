grant select on public.sql_assignments, public.sql_assignment_tasks, public.sql_task_progress, public.sql_task_attempts to authenticated;
grant all on public.sql_assignments, public.sql_assignment_tasks, public.sql_task_solutions, public.sql_task_progress, public.sql_task_attempts to service_role;
