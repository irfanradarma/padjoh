import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, MySQL } from "@codemirror/lang-sql";
import { autocompletion } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { keymap, EditorView } from "@codemirror/view";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";
import SqlChallenges from "./SqlChallenges";
const mk = (n, a, q) => ({
  id: crypto.randomUUID(),
  title: `Query ${n}`,
  query: q || "",
});
const esc = (n) => `\`${n.replaceAll("`", "``")}\``;
export default function SqlPage({ profile, theme }) {
  const admin = !!profile?.is_admin,
    first = useRef(mk(1, admin)),
    [tabs, setTabs] = useState([first.current]),
    [active, setActive] = useState(first.current.id),
    [schema, setSchema] = useState([]),
    [dbs, setDbs] = useState([]),
    [db, setDb] = useState(""),
    [expanded, setExpanded] = useState({}),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [running, setRunning] = useState(false),
    [loading, setLoading] = useState(true),
    [sw, setSw] = useState(240),
    [eh, setEh] = useState(255),
    [menu, setMenu] = useState(null);
  const [mode, setMode] = useState("assignments");
  const tab = tabs.find((x) => x.id === active) || tabs[0],
    query = tab?.query || "";
  const call = useCallback(async (body) => {
    const { data, error: e } = await supabase.functions.invoke(
      "mysql-console",
      { body },
    );
    if (e) {
      let m = e.message;
      try {
        m = (await e.context?.json())?.error || m;
      } catch {}
      throw Error(m);
    }
    if (data?.error) throw Error(data.error);
    return data;
  }, []);
  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    setError("");
    try {
      setSchema((await call({ action: "schema", database: db })).tables || []);
    } catch (e) {
      setError(e.message);
      setSchema([]);
    } finally {
      setLoading(false);
    }
  }, [call, db]);
  useEffect(() => {
    call({ action: "databases" })
      .then((d) => {
        setDbs(d.databases || []);
        setDb(d.databases?.[0] || "");
      })
      .catch((e) => setError(e.message));
  }, [call]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const f = () => setMenu(null);
    addEventListener("click", f);
    return () => removeEventListener("click", f);
  }, []);
  const run = useCallback(
    async (text) => {
      text = text.trim();
      if (!text || running) return;
      setRunning(true);
      setError("");
      setResult(null);
      let t = performance.now();
      try {
        let d = await call({ action: "query", database: db, sql: text });
        setResult({
          ...d,
          clientDurationMs: Math.round(performance.now() - t),
        });
        if (d.schemaChanged) load();
      } catch (e) {
        setError(e.message);
      } finally {
        setRunning(false);
      }
    },
    [call, db, load, running],
  );
  const fromView = useCallback(
    (v, sel) => {
      let r = v.state.selection.main,
        s = v.state.sliceDoc(r.from, r.to);
      run(sel && s.trim() ? s : v.state.doc.toString());
      return true;
    },
    [run],
  );
  const complete = useCallback(
    (c) => {
      let pre = c.state.sliceDoc(0, c.pos),
        names = [...pre.matchAll(/\b(?:FROM|JOIN)\s+`?([\w$]+)`?/gi)].map((x) =>
          x[1].toLowerCase(),
        ),
        word = c.matchBefore(/[\w$]*/);
      if (!c.explicit && !word?.text) return null;
      let options = schema
        .filter((t) => names.includes(t.name.toLowerCase()))
        .flatMap((t) =>
          t.columns.map((x) => ({
            label: x.name,
            type: "property",
            detail: `${t.name} · ${x.type}`,
            boost: 20,
          })),
        );
      return options.length
        ? { from: word.from, options, validFor: /^[\w$]*$/ }
        : null;
    },
    [schema],
  );
  const extensions = useMemo(
    () => [
      sql({
        dialect: MySQL,
        schema: Object.fromEntries(
          schema.map((t) => [t.name, t.columns.map((c) => c.name)]),
        ),
      }),
      autocompletion({ override: [complete], activateOnTyping: true }),
      keymap.of([
        { key: "Mod-Enter", run: (v) => fromView(v, false) },
        { key: "Mod-Shift-Enter", run: (v) => fromView(v, true) },
        indentWithTab,
      ]),
      EditorView.theme({
        "&": {
          height: "100%",
          backgroundColor: theme === "dark" ? "#111827" : "#ffffff",
          color: theme === "dark" ? "#e5e7eb" : "#172033",
        },
        ".cm-scroller": { overflow: "auto" },
        ".cm-gutters": {
          backgroundColor: theme === "dark" ? "#0b1220" : "#f5f7fa",
          color: theme === "dark" ? "#64748b" : "#8a94a6",
          borderRight:
            theme === "dark" ? "1px solid #263244" : "1px solid #dde2ea",
        },
        ".cm-activeLine,.cm-activeLineGutter": {
          backgroundColor: theme === "dark" ? "#172033" : "#f0f6ff",
        },
        ".cm-cursor": {
          borderLeftColor: theme === "dark" ? "#f8fafc" : "#111827",
        },
      }),
    ],
    [schema, complete, fromView, theme],
  );
  const update = (q) =>
      setTabs((a) => a.map((t) => (t.id === active ? { ...t, query: q } : t))),
    add = (q) => {
      let t = mk(tabs.length + 1, admin, q);
      setTabs((a) => [...a, t]);
      setActive(t.id);
    },
    close = (e, id) => {
      e.stopPropagation();
      if (tabs.length === 1) {
        update("");
        return;
      }
      let i = tabs.findIndex((t) => t.id === id),
        a = tabs.filter((t) => t.id !== id);
      setTabs(a);
      if (active === id) setActive(a[Math.max(0, i - 1)].id);
    };
  const preview = (name, fresh = false) => {
    let q = `SELECT *\nFROM ${esc(name)}\nLIMIT 100;`;
    fresh ? add(q) : update(q);
    setMenu(null);
  };
  const resize = (kind, e) => {
    e.preventDefault();
    let start = kind === "s" ? sw : eh,
      origin = kind === "s" ? e.clientX : e.clientY,
      move = (x) => {
        let d = (kind === "s" ? x.clientX : x.clientY) - origin;
        kind === "s"
          ? setSw(Math.max(170, Math.min(480, start + d)))
          : setEh(Math.max(150, Math.min(560, start + d)));
      },
      stop = () => {
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", stop);
      };
    addEventListener("pointermove", move);
    addEventListener("pointerup", stop);
  };
  const cols = useMemo(
      () =>
        result?.columns?.length
          ? result.columns
          : Object.keys(result?.rows?.[0] || {}),
      [result],
    ),
    exportAs = (f) => {
      let sh = XLSX.utils.json_to_sheet(result.rows, { header: cols });
      if (f === "xlsx") {
        let b = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(b, sh, "Results");
        XLSX.writeFile(b, `sql-results-${Date.now()}.xlsx`);
      } else {
        let u = URL.createObjectURL(
            new Blob(["\ufeff" + XLSX.utils.sheet_to_csv(sh)], {
              type: "text/csv",
            }),
          ),
          a = document.createElement("a");
        a.href = u;
        a.download = `sql-results-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(u);
      }
    };
  return (
    <div className="page-content sql-page">
      <div className="page-header sql-page-header">
        <div>
          <h2>SQL Lab</h2>
          <p>
            MySQL classroom database ·{" "}
            {admin ? "administrator access" : "read-only student access"}
          </p>
        </div>
        <span className={"sql-role-badge " + (admin ? "admin" : "")}>
          {admin ? "ADMIN" : "READ ONLY"}
        </span>
      </div>
      <div className="sql-mode-tabs">
        <button
          className={mode === "assignments" ? "active" : ""}
          onClick={() => setMode("assignments")}
        >
          Assignments
        </button>
        <button
          className={mode === "workspace" ? "active" : ""}
          onClick={() => setMode("workspace")}
        >
          Workspace
        </button>
      </div>
      {mode === "assignments" && (
        <SqlChallenges profile={profile} theme={theme} databases={dbs} />
      )}
      <div
        className="sql-workbench"
        style={{
          gridTemplateColumns: `${sw}px 5px minmax(0,1fr)`,
          display: mode === "workspace" ? "grid" : "none",
        }}
      >
        <aside className="sql-schema-panel">
          <div className="sql-panel-title">
            <div className="sql-db-picker">
              <label>Database</label>
              <select
                value={db}
                onChange={(e) => {
                  setDb(e.target.value);
                  setExpanded({});
                }}
              >
                {dbs.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <button onClick={load}>↻</button>
          </div>
          <div className="sql-schema-body">
            {loading ? (
              <div className="sql-muted">Loading schema…</div>
            ) : (
              schema.map((t) => (
                <div
                  key={t.name}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, t: t.name });
                  }}
                >
                  <button
                    className="sql-table-name"
                    onClick={() =>
                      setExpanded((x) => ({ ...x, [t.name]: !x[t.name] }))
                    }
                  >
                    <span>{expanded[t.name] ? "▾" : "▸"}</span>
                    <span className="sql-table-icon">▦</span>
                    <span>{t.name}</span>
                    <small>{t.rowCount ?? "—"}</small>
                  </button>
                  {expanded[t.name] && (
                    <div className="sql-column-list">
                      {t.columns.map((c) => (
                        <div className="sql-column" key={c.name}>
                          <span>{c.key === "PRI" ? "◆" : "·"}</span>
                          <b>{c.name}</b>
                          <small>{c.type}</small>
                        </div>
                      ))}
                      <button
                        className="sql-preview-btn"
                        onClick={() => preview(t.name)}
                      >
                        Preview rows
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
        <div
          className="sql-resizer vertical"
          onPointerDown={(e) => resize("s", e)}
        />
        <section
          className="sql-main-panel"
          style={{ gridTemplateRows: `40px ${eh}px 5px minmax(220px,1fr)` }}
        >
          <div className="sql-query-tabs">
            <div className="sql-tabs-scroll">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={
                    "sql-query-tab " + (t.id === active ? "active" : "")
                  }
                  onClick={() => setActive(t.id)}
                >
                  {t.title}
                  <i onClick={(e) => close(e, t.id)}>×</i>
                </button>
              ))}
            </div>
            <button className="sql-add-tab" onClick={() => add()}>
              ＋
            </button>
            <button
              className="btn btn-primary sql-run-btn"
              onClick={() => run(query)}
              disabled={running}
            >
              {running ? "Running…" : "▶ Run"}
            </button>
          </div>
          <div className="sql-editor-wrap">
            <CodeMirror
              value={query}
              onChange={update}
              extensions={extensions}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                foldGutter: true,
                bracketMatching: true,
                closeBrackets: true,
                highlightActiveLine: true,
                autocompletion: false,
              }}
            />
            <div className="sql-editor-help">
              Ctrl+Enter: run tab · Ctrl+Shift+Enter: run selection · Tab:
              indent
            </div>
          </div>
          <div
            className="sql-resizer horizontal"
            onPointerDown={(e) => resize("e", e)}
          />
          <div className="sql-results-panel">
            <div className="sql-panel-title">
              <span>Results</span>
              <div className="sql-results-actions">
                {result && (
                  <small>
                    {result.rowCount} rows ·{" "}
                    {result.durationMs ?? result.clientDurationMs} ms
                  </small>
                )}
                <button
                  disabled={!result?.rows?.length}
                  onClick={() => exportAs("csv")}
                >
                  CSV
                </button>
                <button
                  disabled={!result?.rows?.length}
                  onClick={() => exportAs("xlsx")}
                >
                  XLSX
                </button>
              </div>
            </div>
            {error ? (
              <div className="sql-error">
                <b>Query failed</b>
                <span>{error}</span>
              </div>
            ) : !result ? (
              <div className="sql-empty">Run a query to see its results.</div>
            ) : result.rows?.length ? (
              <div className="sql-grid-wrap">
                <table className="sql-grid">
                  <thead>
                    <tr>
                      <th>#</th>
                      {cols.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="sql-row-num">{i + 1}</td>
                        {cols.map((c) => (
                          <td key={c}>
                            {r[c] === null ? (
                              <span className="sql-null">NULL</span>
                            ) : typeof r[c] === "object" ? (
                              JSON.stringify(r[c])
                            ) : (
                              String(r[c])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="sql-success">
                ✓ {result.message || "Query executed."}
              </div>
            )}
          </div>
        </section>
      </div>
      {menu && (
        <div
          className="sql-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => preview(menu.t)}>SELECT * LIMIT 100</button>
          <button onClick={() => preview(menu.t, true)}>
            Open in new query tab
          </button>
        </div>
      )}
    </div>
  );
}
