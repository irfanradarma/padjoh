import { useCallback, useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, MySQL } from "@codemirror/lang-sql";
import { supabase } from "../supabaseClient";
const blank = () => ({
  title: "",
  instruction: "",
  starter_sql: "SELECT ",
  sample_output: "",
  solution_sql: "",
  order_matters: false,
});
export default function SqlChallenges({ profile, theme, databases }) {
  const admin = !!profile.is_admin,
    [items, setItems] = useState([]),
    [selected, setSelected] = useState(null),
    [progress, setProgress] = useState([]),
    [task, setTask] = useState(null),
    [code, setCode] = useState(""),
    [result, setResult] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(null),
    [monitor, setMonitor] = useState(null);
  const call = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke("sql-challenges", {
      body,
    });
    if (error) {
      let m = error.message;
      try {
        m = (await error.context?.json())?.error || m;
      } catch {}
      throw Error(m);
    }
    if (data?.error) throw Error(data.error);
    return data;
  }, []);
  const load = useCallback(
    () =>
      call({ action: "list" })
        .then((d) => setItems(d.assignments || []))
        .catch((e) => setMessage(e.message)),
    [call],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function open(a) {
    setBusy(true);
    setMessage("");
    try {
      let d = await call({ action: "get", id: a.id });
      setSelected(d.assignment);
      setProgress(d.progress || []);
      setTask(d.assignment.sql_assignment_tasks[0] || null);
      setCode(d.assignment.sql_assignment_tasks[0]?.starter_sql || "");
      setResult(null);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  function choose(t) {
    setTask(t);
    setCode(
      progress.find((x) => x.task_id === t.id)?.completed_sql ||
        t.starter_sql ||
        "",
    );
    setResult(null);
    setMessage("");
  }
  async function grade() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      let d = await call({ action: "grade", task_id: task.id, sql: code });
      setResult(d.result);
      setMessage(d.feedback);
      if (d.passed) {
        setProgress((p) =>
          p.some((x) => x.task_id === task.id)
            ? p
            : [...p, { task_id: task.id, completed_sql: code }],
        );
        load();
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function edit(a) {
    let tasks = [];
    if (a) tasks = (await call({ action: "solutions", id: a.id })).tasks;
    setEditing({
      assignment: a
        ? { ...a }
        : {
            title: "",
            description: "",
            database_name: databases[0] || "latihan1",
            status: "draft",
            due_at: "",
          },
      tasks: tasks.length ? tasks : [blank()],
    });
  }
  const setA = (k, v) =>
      setEditing((x) => ({ ...x, assignment: { ...x.assignment, [k]: v } })),
    setT = (i, k, v) =>
      setEditing((x) => ({
        ...x,
        tasks: x.tasks.map((t, n) => (n === i ? { ...t, [k]: v } : t)),
      }));
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await call({
        action: "save",
        assignment: editing.assignment,
        tasks: editing.tasks,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function del(a) {
    if (!confirm(`Delete “${a.title}” and all progress?`)) return;
    await call({ action: "delete", id: a.id });
    load();
  }
  async function showMonitor(a) {
    setMonitor({
      title: a.title,
      ...(await call({ action: "monitor", id: a.id })),
    });
  }
  const ext = useMemo(() => [sql({ dialect: MySQL })], [theme]),
    done = (id) => progress.some((x) => x.task_id === id),
    cols = result?.columns || [];
  if (editing)
    return (
      <div className="sql-challenges">
        <div className="sql-challenge-head">
          <button className="btn-sm" onClick={() => setEditing(null)}>
            ← Back
          </button>
          <h3>{editing.assignment.id ? "Edit" : "New"} assignment</h3>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Save assignment
          </button>
        </div>
        <div className="sql-admin-form">
          <input
            className="input"
            placeholder="Assignment title"
            value={editing.assignment.title}
            onChange={(e) => setA("title", e.target.value)}
          />
          <textarea
            className="input"
            placeholder="Description"
            value={editing.assignment.description}
            onChange={(e) => setA("description", e.target.value)}
          />
          <div className="sql-form-row">
            <select
              className="input"
              value={editing.assignment.database_name}
              onChange={(e) => setA("database_name", e.target.value)}
            >
              {databases.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              className="input"
              value={editing.assignment.status}
              onChange={(e) => setA("status", e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <input
              className="input"
              type="datetime-local"
              value={(editing.assignment.due_at || "").slice(0, 16)}
              onChange={(e) => setA("due_at", e.target.value)}
            />
          </div>
          {editing.tasks.map((t, i) => (
            <div className="sql-task-editor" key={i}>
              <div className="sql-task-editor-title">
                <b>Task {i + 1}</b>
                <button
                  onClick={() =>
                    setEditing((x) => ({
                      ...x,
                      tasks: x.tasks.filter((_, n) => n !== i),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
              <input
                className="input"
                placeholder="Task title"
                value={t.title}
                onChange={(e) => setT(i, "title", e.target.value)}
              />
              <textarea
                className="input"
                placeholder="Instructions"
                value={t.instruction}
                onChange={(e) => setT(i, "instruction", e.target.value)}
              />
              <input
                className="input"
                placeholder="Sample output / expected columns"
                value={t.sample_output}
                onChange={(e) => setT(i, "sample_output", e.target.value)}
              />
              <label>Starter SQL</label>
              <textarea
                className="input sql-code-input"
                value={t.starter_sql}
                onChange={(e) => setT(i, "starter_sql", e.target.value)}
              />
              <label>Hidden solution SQL</label>
              <textarea
                className="input sql-code-input"
                value={t.solution_sql}
                onChange={(e) => setT(i, "solution_sql", e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={t.order_matters}
                  onChange={(e) => setT(i, "order_matters", e.target.checked)}
                />{" "}
                Row order matters
              </label>
            </div>
          ))}
          <button
            className="btn-sm"
            onClick={() =>
              setEditing((x) => ({ ...x, tasks: [...x.tasks, blank()] }))
            }
          >
            ＋ Add task
          </button>
        </div>
      </div>
    );
  if (selected)
    return (
      <div className="sql-challenges sql-challenge-play">
        <div className="sql-challenge-head">
          <button
            className="btn-sm"
            onClick={() => {
              setSelected(null);
              load();
            }}
          >
            ← Assignments
          </button>
          <div>
            <h3>{selected.title}</h3>
            <small>
              {selected.database_name} · {progress.length}/
              {selected.sql_assignment_tasks.length} complete
            </small>
          </div>
        </div>
        <div className="sql-play-grid">
          <aside className="sql-task-list">
            {selected.sql_assignment_tasks.map((t, i) => (
              <button
                className={
                  (task?.id === t.id ? "active " : "") +
                  (done(t.id) ? "done" : "")
                }
                key={t.id}
                onClick={() => choose(t)}
              >
                <span>{done(t.id) ? "✓" : i + 1}</span>
                <b>{t.title}</b>
              </button>
            ))}
          </aside>
          <main className="sql-task-work">
            {task && (
              <>
                <div className="sql-task-prompt">
                  <h3>{task.title}</h3>
                  <p>{task.instruction}</p>
                  {task.sample_output && <code>{task.sample_output}</code>}
                </div>
                <div className="sql-challenge-editor">
                  <CodeMirror
                    value={code}
                    onChange={setCode}
                    extensions={ext}
                    basicSetup={{
                      lineNumbers: true,
                      bracketMatching: true,
                      autocompletion: true,
                    }}
                  />
                </div>
                <div className="sql-check-row">
                  <span
                    className={
                      message.startsWith("Correct") ? "pass" : "feedback"
                    }
                  >
                    {message}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={grade}
                    disabled={busy}
                  >
                    {busy ? "Checking…" : "Check answer"}
                  </button>
                </div>
                {result?.rows?.length > 0 && (
                  <div className="sql-grid-wrap sql-challenge-result">
                    <table className="sql-grid">
                      <thead>
                        <tr>
                          {cols.map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.slice(0, 20).map((r, i) => (
                          <tr key={i}>
                            {cols.map((c) => (
                              <td key={c}>{String(r[c] ?? "NULL")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    );
  return (
    <div className="sql-challenges">
      <div className="sql-challenge-head">
        <div>
          <h3>SQL Assignments</h3>
          <small>Complete database challenges and track progress.</small>
        </div>
        {admin && (
          <button className="btn btn-primary" onClick={() => edit(null)}>
            ＋ New assignment
          </button>
        )}
      </div>
      {message && <div className="sql-error">{message}</div>}
      <div className="sql-assignment-cards">
        {items.map((a) => (
          <article key={a.id}>
            <div className="sql-assignment-card-top">
              <span className={a.status}>{a.status}</span>
              <small>{a.database_name}</small>
            </div>
            <h3>{a.title}</h3>
            <p>{a.description}</p>
            <div className="sql-progress">
              <i
                style={{
                  width: `${a.task_count ? (100 * a.completed_count) / a.task_count : 0}%`,
                }}
              />
            </div>
            <small>
              {a.completed_count}/{a.task_count} tasks complete
            </small>
            <div className="sql-card-actions">
              <button className="btn btn-primary" onClick={() => open(a)}>
                {admin ? "Preview" : "Continue"}
              </button>
              {admin && (
                <>
                  <button className="btn-sm" onClick={() => edit(a)}>
                    Edit
                  </button>
                  <button className="btn-sm" onClick={() => showMonitor(a)}>
                    Progress
                  </button>
                  <button className="btn-sm danger" onClick={() => del(a)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {monitor && (
        <div className="pw-overlay">
          <div className="pw-modal sql-monitor">
            <button
              className="sql-modal-close"
              onClick={() => setMonitor(null)}
            >
              ×
            </button>
            <h3>{monitor.title}</h3>
            <table className="sql-grid">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {monitor.students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name || s.npm}</td>
                    <td>{s.class}</td>
                    <td>
                      {s.completed}/{s.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
