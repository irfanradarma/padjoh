import { createClient } from "npm:@supabase/supabase-js@2";
import mysql from "npm:mysql2@3.11.5/promise";
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Content-Type": "application/json",
};
const reply = (x: unknown, s = 200) =>
  new Response(JSON.stringify(x), { status: s, headers: H });
const readonly = (q: string) =>
  /^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(
    q.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, ""),
  ) &&
  !/;[\s\S]*\S|\b(INTO\s+(OUTFILE|DUMPFILE)|SLEEP\s*\(|BENCHMARK\s*\(|LOAD_FILE\s*\(|FOR\s+UPDATE)\b/i.test(
    q.trim().replace(/;\s*$/, ""),
  );
function opts(url: string, db: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: db,
    ssl: { rejectUnauthorized: true },
    connectTimeout: 25000,
    multipleStatements: false,
  };
}
async function run(url: string, db: string, sql: string) {
  let c;
  try {
    c = await mysql.createConnection(opts(url, db));
  } catch (e) {
    await new Promise((r) => setTimeout(r, 750));
    c = await mysql.createConnection(opts(url, db));
  }
  try {
    const [r, f] = await c.query({ sql, timeout: 10000 });
    if (!Array.isArray(r)) throw Error("Answer queries must return rows.");
    return {
      rows: r.slice(0, 500) as any[],
      columns: f?.map((x) => x.name) || [],
    };
  } finally {
    await c.end();
  }
}
const val = (v: any) =>
  v === null
    ? "␀"
    : v instanceof Date
      ? v.toISOString()
      : typeof v === "number"
        ? String(Number(v))
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
function signature(r: { rows: any[]; columns: string[] }, ordered: boolean) {
  const rows = r.rows.map((x) =>
    JSON.stringify(r.columns.map((c) => val(x[c]))),
  );
  if (!ordered) rows.sort();
  return JSON.stringify([r.columns, rows]);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const token = (req.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) return reply({ error: "Sign in required." }, 401);
    const sb = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        { auth: { persistSession: false } },
      ),
      {
        data: { user },
      } = await sb.auth.getUser(token);
    if (!user) return reply({ error: "Invalid session." }, 401);
    const { data: p } = await sb
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single(),
      admin = !!p?.is_admin,
      b = await req.json(),
      action = b.action;
    if (action === "list") {
      let q = sb
        .from("sql_assignments")
        .select("*,sql_assignment_tasks(id)")
        .order("created_at");
      if (!admin) q = q.eq("status", "published");
      const { data: a, error: e } = await q;
      if (e) throw e;
      const { data: done } = await sb
        .from("sql_task_progress")
        .select("task_id")
        .eq("user_id", user.id);
      const set = new Set((done || []).map((x) => x.task_id));
      return reply({
        assignments: (a || []).map((x) => ({
          ...x,
          task_count: x.sql_assignment_tasks.length,
          completed_count: x.sql_assignment_tasks.filter((t: any) =>
            set.has(t.id),
          ).length,
          sql_assignment_tasks: undefined,
        })),
      });
    }
    if (action === "get") {
      const { data: a, error: e } = await sb
        .from("sql_assignments")
        .select("*,sql_assignment_tasks(*)")
        .eq("id", b.id)
        .single();
      if (e) throw e;
      if (!admin && a.status !== "published")
        return reply({ error: "Assignment unavailable." }, 403);
      a.sql_assignment_tasks.sort((x: any, y: any) => x.position - y.position);
      const { data: done } = await sb
        .from("sql_task_progress")
        .select("task_id,completed_at,completed_sql")
        .eq("user_id", user.id)
        .in(
          "task_id",
          a.sql_assignment_tasks.map((x: any) => x.id),
        );
      return reply({ assignment: a, progress: done || [] });
    }
    if (action === "save") {
      if (!admin) return reply({ error: "Admin only." }, 403);
      const a = b.assignment,
        id = a.id || crypto.randomUUID();
      const { error: e } = await sb.from("sql_assignments").upsert({
        id,
        title: a.title,
        description: a.description || "",
        database_name: a.database_name,
        status: a.status || "draft",
        due_at: a.due_at || null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      });
      if (e) throw e;
      await sb.from("sql_assignment_tasks").delete().eq("assignment_id", id);
      for (let i = 0; i < b.tasks.length; i++) {
        const t = b.tasks[i],
          tid = crypto.randomUUID();
        const { error: te } = await sb.from("sql_assignment_tasks").insert({
          id: tid,
          assignment_id: id,
          position: i + 1,
          title: t.title,
          instruction: t.instruction,
          starter_sql: t.starter_sql || "",
          sample_output: t.sample_output || "",
          order_matters: !!t.order_matters,
          database_name: t.database_name || a.database_name,
        });
        if (te) throw te;
        const { error: se } = await sb
          .from("sql_task_solutions")
          .insert({ task_id: tid, solution_sql: t.solution_sql });
        if (se) throw se;
      }
      return reply({ id });
    }
    if (action === "delete") {
      if (!admin) return reply({ error: "Admin only." }, 403);
      const { error: e } = await sb
        .from("sql_assignments")
        .delete()
        .eq("id", b.id);
      if (e) throw e;
      return reply({ ok: true });
    }
    if (action === "solutions") {
      if (!admin) return reply({ error: "Admin only." }, 403);
      const { data: t, error: e } = await sb
        .from("sql_assignment_tasks")
        .select("*,sql_task_solutions(solution_sql)")
        .eq("assignment_id", b.id)
        .order("position");
      if (e) throw e;
      return reply({
        tasks: (t || []).map((x: any) => ({
          ...x,
          solution_sql: x.sql_task_solutions?.solution_sql || "",
          sql_task_solutions: undefined,
        })),
      });
    }
    if (action === "grade") {
      const sql = String(b.sql || "").trim();
      if (!readonly(sql))
        return reply({ error: "Only one read-only query is allowed." }, 400);
      const { data: t, error: e } = await sb
        .from("sql_assignment_tasks")
        .select(
          "*,sql_assignments!inner(database_name,status),sql_task_solutions!inner(solution_sql)",
        )
        .eq("id", b.task_id)
        .single();
      if (e) throw e;
      if (!admin && t.sql_assignments.status !== "published")
        return reply({ error: "Assignment unavailable." }, 403);
      const url = Deno.env.get("MYSQL_STUDENT_URL") || "";
      const database = t.database_name || t.sql_assignments.database_name;
      const actual = await run(url, database, sql),
        expected = await run(url, database, t.sql_task_solutions.solution_sql),
        passed =
          signature(actual, t.order_matters) ===
          signature(expected, t.order_matters),
        feedback = passed
          ? "Correct! Task completed."
          : actual.columns.join("|") !== expected.columns.join("|")
            ? `Expected columns: ${expected.columns.join(", ")}`
            : `Result has ${actual.rows.length} row(s); expected ${expected.rows.length}.`;
      await sb.from("sql_task_attempts").insert({
        task_id: t.id,
        user_id: user.id,
        submitted_sql: sql,
        passed,
        feedback,
      });
      if (passed)
        await sb.from("sql_task_progress").upsert({
          task_id: t.id,
          user_id: user.id,
          completed_sql: sql,
          completed_at: new Date().toISOString(),
        });
      return reply({ passed, feedback, result: actual });
    }
    if (action === "monitor") {
      if (!admin) return reply({ error: "Admin only." }, 403);
      const { data: s } = await sb
        .from("profiles")
        .select("id,npm,name,class")
        .eq("is_admin", false);
      const { data: t } = await sb
        .from("sql_assignment_tasks")
        .select("id")
        .eq("assignment_id", b.id);
      const ids = (t || []).map((x) => x.id);
      const { data: d } = ids.length
        ? await sb
            .from("sql_task_progress")
            .select("user_id,task_id,completed_at")
            .in("task_id", ids)
        : { data: [] };
      return reply({
        students: (s || []).map((x) => ({
          ...x,
          completed: (d || []).filter((y) => y.user_id === x.id).length,
          total: ids.length,
        })),
      });
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    const x = e as any;
    return reply(
      {
        error: x?.message || x?.details || x?.hint || String(e),
        code: x?.code,
      },
      500,
    );
  }
});
