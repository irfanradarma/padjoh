import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const STATUS_LABELS = {
  hidden: "Belum dibuka",
  checkin: "Check-in",
  phase1_active: "Fase 1 berlangsung",
  phase1_results: "Leaderboard Fase 1",
  phase2_active: "Fase 2 berlangsung",
  phase2_results: "Leaderboard Fase 1 + 2",
  phase3_active: "Fase 3 berlangsung",
  phase3_results: "Final qualification",
  groups_ready: "Pembagian grup",
  audit_active: "Audit Phase",
  finished: "Selesai",
};

function currentPhase(status = "") {
  const match = /^phase([123])_active$/.exec(status);
  return match ? Number(match[1]) : 0;
}

function useRemaining(deadline) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () =>
      setRemaining(
        deadline
          ? Math.max(
              0,
              Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000),
            )
          : 0,
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return remaining;
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function phaseTitle(phase) {
  return phase === 1
    ? "Basic SELECT · FROM · WHERE"
    : phase === 2
      ? "Aggregate & Date Functions"
      : "JOIN";
}

function Leaderboard({ rows, title = "Leaderboard" }) {
  if (!rows?.length) return null;
  return (
    <section className="sc-card">
      <div className="sc-card-head">
        <div>
          <span className="sc-eyebrow">CLASS ONLY</span>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Mahasiswa</th>
              <th>NPM</th>
              <th>Ketepatan</th>
              <th>Kecepatan</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.user_id}
                className={row.rank <= 3 ? `sc-top-${row.rank}` : ""}
              >
                <td>
                  <b>#{row.rank}</b>
                </td>
                <td>{row.name}</td>
                <td>{row.npm}</td>
                <td>{Number(row.accuracy).toFixed(1)}</td>
                <td>{Number(row.speed).toFixed(1)}</td>
                <td>
                  <strong>{Number(row.total).toFixed(1)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Monitor({ rows, questionCount, active }) {
  return (
    <section className="sc-card">
      <div className="sc-card-head">
        <div>
          <span className="sc-eyebrow">LIVE MONITOR</span>
          <h3>Progres mahasiswa</h3>
        </div>
      </div>
      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Mahasiswa</th>
              <th>NPM</th>
              <th>Check-in</th>
              {active && (
                <>
                  <th>Terjawab</th>
                  <th>Submission</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.npm}</td>
                <td>{row.checked_in ? "✓" : "—"}</td>
                {active && (
                  <>
                    <td>
                      {row.checked_in
                        ? `${row.answered}/${questionCount}`
                        : "—"}
                    </td>
                    <td>
                      {row.submission
                        ? row.submission.auto_submitted
                          ? "Auto-submit"
                          : "Submitted"
                        : row.checked_in
                          ? "In progress"
                          : "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupCards({ groups, editable, onMove }) {
  if (!groups?.length) return null;
  return (
    <section className="sc-card">
      <div className="sc-card-head">
        <div>
          <span className="sc-eyebrow">BALANCED TEAMS</span>
          <h3>Pembagian grup</h3>
        </div>
      </div>
      <div className="sc-groups">
        {groups.map((group) => (
          <article key={group.id} className="sc-group">
            <div className="sc-group-head">
              <b>Grup {group.group_number}</b>
              <span>
                Total {Number(group.total_qualification_score).toFixed(1)}
              </span>
            </div>
            {group.members.map((member) => (
              <div className="sc-member" key={member.user_id}>
                <div>
                  <b>{member.name}</b>
                  <small>
                    {member.npm} ·{" "}
                    {Number(member.qualification_score).toFixed(1)}
                  </small>
                </div>
                {editable && (
                  <select
                    value={group.id}
                    onChange={(event) =>
                      onMove(member.user_id, event.target.value)
                    }
                  >
                    {groups.map((target) => (
                      <option value={target.id} key={target.id}>
                        Grup {target.group_number}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

const WORK_STATUS = {
  unassigned: ["Belum diambil", "idle"],
  assigned: ["Belum dikerjakan", "assigned"],
  draft: ["Draft", "draft"],
  needs_revision: ["Perlu diperbaiki", "revision"],
  submitted: ["Menunggu review", "submitted"],
  completed: ["Selesai", "completed"],
};

function WorkStatus({ value }) {
  const [label, tone] = WORK_STATUS[value] || WORK_STATUS.unassigned;
  return <span className={`sc-work-status ${tone}`}>{label}</span>;
}

function AssignmentBoard({ worksheet, group, userId, active, onAction }) {
  const rows = worksheet?.rows || [];
  const assigned = rows.filter((row) => row.assignee_id).length;
  const workloads = Object.fromEntries(
    (group?.members || []).map((member) => [
      member.user_id,
      rows.filter((row) => row.assignee_id === member.user_id).length,
    ]),
  );

  return (
    <section className="sc-card sc-assignment-board">
      <div className="sc-card-head">
        <div>
          <span className="sc-eyebrow">AUDIT PROGRAM ASSIGNMENT</span>
          <h3>Pembagian prosedur · Grup {group?.group_number}</h3>
          <p>
            Ambil prosedur untuk diri sendiri. Workpaper terbuka setelah semua
            prosedur memiliki penanggung jawab.
          </p>
        </div>
        <div className="sc-allocation-count">
          <b>
            {assigned}/{rows.length}
          </b>
          <span>assigned</span>
        </div>
      </div>
      <div className="sc-allocation-progress">
        <i
          style={{
            width: `${rows.length ? (assigned / rows.length) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="sc-workload-row">
        {(group?.members || []).map((member) => (
          <span
            key={member.user_id}
            className={member.user_id === userId ? "mine" : ""}
          >
            {member.name} <b>{workloads[member.user_id] || 0}</b>
          </span>
        ))}
      </div>
      <div className="sc-procedure-board">
        {rows.map((row) => {
          const mine = row.assignee_id === userId;
          const canRelease =
            mine &&
            row.status === "assigned" &&
            !row.query_text &&
            !row.conclusion;
          return (
            <article key={row.procedure_id} className={mine ? "mine" : ""}>
              <div className="sc-procedure-order">
                {String(row.order_num).padStart(2, "0")}
              </div>
              <div>
                <h4>{row.title}</h4>
                <div className="sc-owner-line">
                  <WorkStatus value={row.status} />
                  <span>
                    {row.assignee_name
                      ? `${row.assignee_name} · ${row.assignee_npm}`
                      : "Belum ada pemilik"}
                  </span>
                </div>
              </div>
              {active && !row.assignee_id && (
                <button
                  className="btn-sm"
                  onClick={() =>
                    onAction("claim_procedure", {
                      procedure_id: row.procedure_id,
                    })
                  }
                >
                  Ambil
                </button>
              )}
              {active && canRelease && (
                <button
                  className="btn-sm danger"
                  onClick={() =>
                    onAction("unclaim_procedure", {
                      procedure_id: row.procedure_id,
                    })
                  }
                >
                  Lepas
                </button>
              )}
            </article>
          );
        })}
      </div>
      {worksheet?.allocation_complete && (
        <div className="sc-allocation-ready">
          ✓ Pembagian lengkap. Workspace individual sudah terbuka.
        </div>
      )}
    </section>
  );
}

function ExpectedOutput({ row }) {
  const columns = row.expected_columns || [];
  const samples = row.sample_rows || [];
  return (
    <aside className="sc-expected-panel">
      <span className="sc-eyebrow">EXPECTED OUTPUT</span>
      <h4>Contoh bentuk hasil</h4>
      <p>
        Data berikut hanya contoh dummy. Query Anda dinilai menggunakan seluruh
        hasil pada database kelas.
      </p>
      <div className="sc-sample-table-wrap">
        <table className="sc-sample-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {samples.map((sample, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column}>
                    {sample[column] === null
                      ? "NULL"
                      : String(sample[column] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sc-output-rules">
        <b>Yang diperiksa otomatis</b>
        <span>Nama dan urutan kolom</span>
        <span>Jumlah serta isi seluruh baris</span>
        <span>
          {row.order_sensitive
            ? "Urutan baris diperiksa"
            : "Urutan baris diabaikan"}
        </span>
      </div>
      {row.validation_feedback && (
        <div
          className={
            row.validation_feedback.passed
              ? "sc-validation passed"
              : "sc-validation failed"
          }
        >
          <b>
            {row.validation_feedback.passed ? "Query cocok" : "Belum cocok"}
          </b>
          <span>{row.validation_feedback.message}</span>
          {Number.isInteger(row.validation_feedback.actual_row_count) && (
            <small>
              Output Anda {row.validation_feedback.actual_row_count} baris ·
              target {row.validation_feedback.expected_row_count} baris
            </small>
          )}
        </div>
      )}
    </aside>
  );
}

function AuditWorkspace({
  worksheet,
  group,
  userId,
  admin,
  editable,
  onAction,
}) {
  const available = (worksheet?.rows || []).filter(
    (row) => admin || row.assignee_id === userId,
  );
  const [activeId, setActiveId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});

  useEffect(() => {
    if (!available.length) return;
    setActiveId((current) =>
      available.some((row) => row.procedure_id === current)
        ? current
        : available[0].procedure_id,
    );
    setDrafts((current) => {
      if (admin)
        return Object.fromEntries(
          available.map((row) => [
            row.procedure_id,
            {
              query_text: row.query_text || "",
              conclusion: row.conclusion || "",
            },
          ]),
        );
      let changed = false;
      const next = { ...current };
      for (const row of available) {
        if (Object.prototype.hasOwnProperty.call(next, row.procedure_id))
          continue;
        next[row.procedure_id] = {
          query_text: row.query_text || "",
          conclusion: row.conclusion || "",
        };
        changed = true;
      }
      return changed ? next : current;
    });
  }, [worksheet, available.length, admin]);

  const row =
    available.find((item) => item.procedure_id === activeId) || available[0];
  if (!row)
    return (
      <section className="sc-card sc-center">
        <h3>Belum ada prosedur milik Anda</h3>
        <p>Kembali ke assignment board dan ambil sedikitnya satu prosedur.</p>
      </section>
    );

  const draft = drafts[row.procedure_id] || {
    query_text: row.query_text || "",
    conclusion: row.conclusion || "",
  };
  const locked = !editable || row.status === "completed";
  const update = (field, value) =>
    setDrafts((current) => ({
      ...current,
      [row.procedure_id]: { ...draft, [field]: value },
    }));

  async function perform(action, extra = {}) {
    setBusy(true);
    await onAction(action, {
      group_id: worksheet.group_id,
      procedure_id: row.procedure_id,
      ...draft,
      ...extra,
    });
    setBusy(false);
  }

  return (
    <section className="sc-audit-workspace">
      <nav className="sc-my-procedures">
        <div>
          <span className="sc-eyebrow">
            {admin ? "GROUP WORK" : "MY PROCEDURES"}
          </span>
          <h3>{available.length} workpaper</h3>
        </div>
        {available.map((item) => (
          <button
            key={item.procedure_id}
            className={item.procedure_id === row.procedure_id ? "active" : ""}
            onClick={() => setActiveId(item.procedure_id)}
          >
            <span>{String(item.order_num).padStart(2, "0")}</span>
            <div>
              <b>{item.title}</b>
              <small>
                {admin ? item.assignee_name : WORK_STATUS[item.status]?.[0]}
              </small>
            </div>
            <WorkStatus value={item.status} />
          </button>
        ))}
      </nav>
      <main className="sc-work-editor">
        <header>
          <div>
            <span>PROSEDUR {String(row.order_num).padStart(2, "0")}</span>
            <h3>{row.title}</h3>
          </div>
          <WorkStatus value={row.status} />
        </header>
        <div className="sc-instruction">
          <b>Prosedur audit</b>
          <p>{row.instruction}</p>
        </div>
        <label>
          SQL query
          <textarea
            className="sc-query-input"
            value={draft.query_text || ""}
            readOnly={locked}
            onChange={(event) => update("query_text", event.target.value)}
            spellCheck="false"
            placeholder="SELECT ..."
          />
        </label>
        <label>
          Kesimpulan auditor
          <textarea
            value={draft.conclusion || ""}
            readOnly={locked}
            onChange={(event) => update("conclusion", event.target.value)}
            placeholder="Jelaskan makna hasil query dan implikasinya bagi audit..."
          />
        </label>
        {row.review_feedback && (
          <div className="sc-review-feedback">
            <b>Catatan dosen</b>
            <span>{row.review_feedback}</span>
          </div>
        )}
        {!admin && !locked && (
          <div className="sc-editor-actions">
            <span>
              Draft tidak ditimpa refresh · Percobaan submit{" "}
              {row.attempt_count || 0}
            </span>
            <button
              className="btn-sm"
              disabled={busy}
              onClick={() => perform("save_worksheet")}
            >
              Save Draft
            </button>
            <button
              className="btn-sm btn-primary"
              disabled={
                busy || !draft.query_text?.trim() || !draft.conclusion?.trim()
              }
              onClick={() => perform("submit_worksheet")}
            >
              {busy ? "Memproses…" : "Submit Answer"}
            </button>
          </div>
        )}
        {admin && row.status === "submitted" && (
          <div className="sc-admin-review">
            <textarea
              value={reviewNotes[row.procedure_id] || ""}
              onChange={(event) =>
                setReviewNotes((current) => ({
                  ...current,
                  [row.procedure_id]: event.target.value,
                }))
              }
              placeholder="Catatan review kesimpulan (wajib jika meminta revisi)"
            />
            <button
              className="btn-sm danger"
              onClick={() =>
                perform("admin_review_worksheet", {
                  approved: false,
                  feedback: reviewNotes[row.procedure_id] || "",
                })
              }
            >
              Minta revisi
            </button>
            <button
              className="btn-sm btn-primary"
              onClick={() =>
                perform("admin_review_worksheet", {
                  approved: true,
                  feedback: reviewNotes[row.procedure_id] || "",
                })
              }
            >
              Setujui kesimpulan
            </button>
          </div>
        )}
      </main>
      <ExpectedOutput row={row} />
    </section>
  );
}

function StudentPhase({ state, invoke, reload }) {
  const phase = currentPhase(state.run.status);
  const remaining = useRemaining(state.run.stage_deadline);
  const initial = Object.fromEntries(
    (state.answers || []).map((answer) => [
      answer.question_id,
      answer.answer_index,
    ]),
  );
  const [answers, setAnswers] = useState(initial);
  const [saving, setSaving] = useState({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(
    () =>
      setAnswers(
        Object.fromEntries(
          (state.answers || []).map((answer) => [
            answer.question_id,
            answer.answer_index,
          ]),
        ),
      ),
    [state.answers],
  );
  useEffect(() => {
    if (remaining === 0) reload();
  }, [remaining, reload]);

  async function choose(questionId, answerIndex) {
    setAnswers((current) => ({ ...current, [questionId]: answerIndex }));
    setSaving((current) => ({ ...current, [questionId]: true }));
    try {
      await invoke("submit_answer", {
        question_id: questionId,
        answer_index: answerIndex,
      });
    } finally {
      setSaving((current) => ({ ...current, [questionId]: false }));
    }
  }
  async function submit() {
    if (
      !window.confirm(
        `Submit Fase ${phase}? Jawaban tidak dapat diubah setelah submission.`,
      )
    )
      return;
    setSubmitting(true);
    await invoke("submit_phase");
    await reload();
    setSubmitting(false);
  }
  return (
    <div className="sc-phase">
      <div className="sc-phase-top">
        <div>
          <span className="sc-eyebrow">QUALIFICATION PHASE {phase}</span>
          <h2>{phaseTitle(phase)}</h2>
        </div>
        <div className={`sc-timer ${remaining < 60 ? "urgent" : ""}`}>
          {formatTime(remaining)}
        </div>
      </div>
      <div className="sc-question-list">
        {(state.questions || []).map((question, index) => (
          <article className="sc-question" key={question.id}>
            <div className="sc-question-num">{index + 1}</div>
            <div className="sc-question-body">
              <h4>{question.prompt}</h4>
              <div className="sc-options">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    className={
                      answers[question.id] === optionIndex ? "selected" : ""
                    }
                    onClick={() => choose(question.id, optionIndex)}
                    disabled={remaining === 0}
                  >
                    <span>{String.fromCharCode(65 + optionIndex)}</span>
                    <code>{option}</code>
                    {saving[question.id] &&
                      answers[question.id] === optionIndex && <i>saving…</i>}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="sc-submit-bar">
        <span>
          {Object.keys(answers).length}/{state.questions?.length || 0} terjawab
          · jawaban tersimpan otomatis
        </span>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={submitting || remaining === 0}
        >
          {submitting ? "Submitting…" : `Submit Fase ${phase}`}
        </button>
      </div>
    </div>
  );
}

export default function SqlStudyCaseExercise({ profile }) {
  const admin = Boolean(profile.is_admin);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(profile.class || "");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");

  const call = useCallback(
    async (action, extra = {}) => {
      const { data, error: functionError } = await supabase.functions.invoke(
        "sql-study-case",
        { body: { action, class: selectedClass, ...extra } },
      );
      if (functionError || data?.error)
        throw new Error(data?.error || functionError.message);
      return data;
    },
    [selectedClass],
  );

  const load = useCallback(async () => {
    if (admin && !selectedClass) return;
    try {
      setError("");
      setState(await call("get_state"));
    } catch (value) {
      setError(value.message);
    } finally {
      setLoading(false);
    }
  }, [admin, selectedClass, call]);

  useEffect(() => {
    if (!admin) return;
    supabase.functions
      .invoke("sql-study-case", { body: { action: "classes" } })
      .then(({ data }) => {
        const items = data?.classes || [];
        setClasses(items);
        setSelectedClass((current) => current || items[0]?.name || "");
      });
  }, [admin]);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useEffect(() => {
    if (!state?.visible || ["hidden", "finished"].includes(state.run?.status))
      return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [state?.visible, state?.run?.status, load]);

  async function act(action, extra = {}) {
    try {
      setError("");
      const result = await call(action, extra);
      await load();
      return result;
    } catch (value) {
      setError(value.message);
      return null;
    }
  }
  async function createRun() {
    if (code.trim().length < 4) {
      setError("Check-in code minimal 4 karakter.");
      return;
    }
    await act("admin_create_run", { checkin_code: code });
  }

  const run = state?.run;
  const phase = currentPhase(run?.status);
  const remaining = useRemaining(run?.stage_deadline);
  const myGroup = state?.groups?.find(
    (group) => group.id === state.my_group_id,
  );
  const visibleGroupId =
    selectedGroup || (admin ? state?.groups?.[0]?.id : state?.my_group_id);
  const visibleGroup = state?.groups?.find(
    (group) => group.id === visibleGroupId,
  );
  const visibleWorksheet = state?.worksheets?.find(
    (item) => item.group_id === visibleGroupId,
  );
  const auditProgress = useMemo(
    () =>
      (state?.worksheets || []).map((item) => ({
        group_id: item.group_id,
        assigned: item.rows.filter((row) => row.assignee_id).length,
        filled: item.rows.filter((row) =>
          ["submitted", "completed"].includes(row.status),
        ).length,
        completed: item.rows.filter((row) => row.status === "completed").length,
        total: item.rows.length,
      })),
    [state?.worksheets],
  );

  if (loading)
    return (
      <div className="empty-state">
        <p>Memuat SQL Study Case…</p>
      </div>
    );
  return (
    <div className="sc-shell">
      <div className="sc-hero">
        <div>
          <span className="sc-eyebrow">POST-UTS · EXERCISE</span>
          <h2>SQL Audit Investigation</h2>
          <p>Qualification challenge dan investigasi audit berbasis SQL.</p>
        </div>
        {admin && (
          <label>
            Kelas
            <select
              value={selectedClass}
              onChange={(event) => {
                setSelectedClass(event.target.value);
                setSelectedGroup("");
                setState(null);
              }}
            >
              {classes.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <div className="sql-error">{error}</div>}

      {!state?.visible && admin && (
        <section className="sc-card sc-create">
          <h3>Siapkan aktivitas untuk {selectedClass}</h3>
          <p>
            Aktivitas masih tersembunyi dari mahasiswa sampai check-in dibuka.
          </p>
          <div>
            <input
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Check-in code"
            />
            <button className="btn btn-primary" onClick={createRun}>
              Create activity
            </button>
          </div>
        </section>
      )}
      {!state?.visible && !admin && (
        <div className="empty-state sc-hidden">
          <p>Belum ada SQL Study Case yang dibuka untuk kelas Anda.</p>
        </div>
      )}

      {run && (
        <div className="sc-stagebar">
          <span className="sc-stage-dot" />
          <b>{STATUS_LABELS[run.status]}</b>
          <small>Kelas {run.class}</small>
          {phase > 0 && <strong>{formatTime(remaining)}</strong>}
        </div>
      )}

      {admin && run?.status === "hidden" && (
        <section className="sc-card sc-center">
          <p>Mahasiswa belum dapat melihat aktivitas ini.</p>
          <button
            className="btn btn-primary"
            onClick={() => act("admin_open_checkin")}
          >
            Open check-in
          </button>
        </section>
      )}
      {admin && run?.status === "checkin" && (
        <>
          <Monitor rows={state.monitor} />
          <div className="sc-admin-next">
            <button
              className="btn btn-primary"
              onClick={() => act("admin_start_phase", { phase: 1 })}
            >
              Start Phase 1 · 5 minutes
            </button>
          </div>
        </>
      )}
      {admin && phase > 0 && (
        <>
          <Monitor
            rows={state.monitor}
            questionCount={state.question_count}
            active
          />
          <div className="sc-admin-next">
            <span>
              Fase otomatis selesai ketika semua peserta submit atau waktu
              habis.
            </span>
            <button
              className="btn btn-danger"
              onClick={() => act("admin_finish_phase")}
            >
              End phase now
            </button>
          </div>
        </>
      )}
      {admin && run?.status === "phase1_results" && (
        <>
          <Leaderboard rows={state.leaderboard} title="Leaderboard Fase 1" />
          <div className="sc-admin-next">
            <button
              className="btn btn-primary"
              onClick={() => act("admin_start_phase", { phase: 2 })}
            >
              Start Phase 2 · 5 minutes
            </button>
          </div>
        </>
      )}
      {admin && run?.status === "phase2_results" && (
        <>
          <Leaderboard
            rows={state.leaderboard}
            title="Leaderboard Fase 1 + 2"
          />
          <div className="sc-admin-next">
            <button
              className="btn btn-primary"
              onClick={() => act("admin_start_phase", { phase: 3 })}
            >
              Start Phase 3 · 5 minutes
            </button>
          </div>
        </>
      )}
      {admin &&
        ["groups_ready", "audit_active", "finished"].includes(run?.status) && (
          <>
            <Leaderboard
              rows={state.leaderboard}
              title="Final Qualification Leaderboard"
            />
            <GroupCards
              groups={state.groups}
              editable={run.status === "groups_ready"}
              onMove={(userId, targetGroupId) =>
                act("admin_move_member", {
                  user_id: userId,
                  target_group_id: targetGroupId,
                })
              }
            />
          </>
        )}
      {admin && run?.status === "groups_ready" && (
        <div className="sc-admin-next">
          <span>Periksa keseimbangan grup sebelum membuka Audit Phase.</span>
          <button
            className="btn btn-primary"
            onClick={() => act("admin_start_audit")}
          >
            Start Audit Phase
          </button>
        </div>
      )}
      {admin && ["audit_active", "finished"].includes(run?.status) && (
        <>
          <section className="sc-card">
            <div className="sc-card-head">
              <div>
                <span className="sc-eyebrow">GROUP MONITOR</span>
                <h3>Progress workpaper</h3>
              </div>
              {run.status === "audit_active" && (
                <button
                  className="btn btn-danger"
                  onClick={() => act("admin_finish_audit")}
                >
                  Finish activity
                </button>
              )}
            </div>
            <div className="sc-group-progress">
              {state.groups.map((group) => {
                const progress = auditProgress.find(
                  (item) => item.group_id === group.id,
                );
                return (
                  <button
                    className={visibleGroupId === group.id ? "active" : ""}
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                  >
                    Grup {group.group_number}
                    <b>
                      {progress?.completed || 0}/{progress?.total || 0} selesai
                    </b>
                    <small>
                      {progress?.assigned || 0} assigned ·{" "}
                      {progress?.filled || 0} submitted
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
          {visibleWorksheet && (
            <>
              <AssignmentBoard
                worksheet={visibleWorksheet}
                group={visibleGroup}
                userId={profile.id}
                active={false}
                onAction={act}
              />
              {visibleWorksheet.allocation_complete && (
                <AuditWorkspace
                  key={visibleWorksheet.group_id}
                  worksheet={visibleWorksheet}
                  group={visibleGroup}
                  userId={profile.id}
                  admin
                  editable={false}
                  onAction={act}
                />
              )}
            </>
          )}
        </>
      )}

      {!admin && run?.status === "checkin" && !state.participant && (
        <section className="sc-card sc-checkin">
          <span className="sc-lock">⌨</span>
          <h3>Check-in SQL Study Case</h3>
          <p>Masukkan kode yang diberikan dosen untuk bergabung.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              act("checkin", { code });
            }}
          >
            <input
              className="input"
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Check-in code"
            />
            <button className="btn btn-primary">Check-in</button>
          </form>
        </section>
      )}
      {!admin && run?.status === "checkin" && state.participant && (
        <section className="sc-card sc-center">
          <h3>Check-in berhasil</h3>
          <p>Menunggu dosen memulai Fase 1.</p>
        </section>
      )}
      {!admin && phase > 0 && state.participant && (
        <StudentPhase state={state} invoke={call} reload={load} />
      )}
      {!admin && /phase[12]_results/.test(run?.status || "") && (
        <>
          <Leaderboard
            rows={state.leaderboard}
            title={STATUS_LABELS[run.status]}
          />
          <section className="sc-card sc-center">
            <p>Menunggu dosen membuka fase berikutnya.</p>
          </section>
        </>
      )}
      {!admin &&
        ["groups_ready", "audit_active", "finished"].includes(run?.status) && (
          <>
            <Leaderboard
              rows={state.leaderboard}
              title="Final Qualification Leaderboard"
            />
            <GroupCards groups={state.groups} />
            {myGroup && (
              <div className="sc-my-team">
                Anda berada di <b>Grup {myGroup.group_number}</b>.
              </div>
            )}
          </>
        )}
      {!admin && run?.status === "groups_ready" && (
        <section className="sc-card sc-center">
          <p>Menunggu dosen membuka Audit Phase.</p>
        </section>
      )}
      {!admin &&
        ["audit_active", "finished"].includes(run?.status) &&
        visibleWorksheet && (
          <>
            <AssignmentBoard
              worksheet={visibleWorksheet}
              group={myGroup}
              userId={profile.id}
              active={run.status === "audit_active"}
              onAction={act}
            />
            {visibleWorksheet.allocation_complete && (
              <AuditWorkspace
                key={visibleWorksheet.group_id}
                worksheet={visibleWorksheet}
                group={myGroup}
                userId={profile.id}
                admin={false}
                editable={run.status === "audit_active"}
                onAction={act}
              />
            )}
          </>
        )}
    </div>
  );
}
