import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Belum pernah submit";

export default function SqlProgressDashboard({ assignments, onClose }) {
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id || "");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!assignmentId && assignments[0]) setAssignmentId(assignments[0].id);
  }, [assignmentId, assignments]);

  useEffect(() => {
    if (!assignmentId) return;
    setLoading(true);
    setError("");
    supabase.functions
      .invoke("sql-challenges", {
        body: { action: "monitor", id: assignmentId },
      })
      .then(({ data, error }) => {
        if (error || data?.error) throw Error(data?.error || error.message);
        setStudents(data.students || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [assignmentId, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter(
        (s) =>
          !q ||
          [s.name, s.npm, s.class].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(q),
          ),
      )
      .sort((a, b) =>
        String(a.name || a.npm).localeCompare(String(b.name || b.npm), "id"),
      );
  }, [students, search]);
  const summary = useMemo(
    () => ({
      complete: students.filter((s) => s.total > 0 && s.completed === s.total)
        .length,
      active: students.filter((s) => s.completed > 0 && s.completed < s.total)
        .length,
      notStarted: students.filter((s) => s.completed === 0).length,
    }),
    [students],
  );

  return (
    <div className="sql-progress-page">
      <div className="sql-progress-header">
        <div>
          <h2>Progress Assignment SQL</h2>
          <p>Pantau penyelesaian dan submission terakhir setiap mahasiswa.</p>
        </div>
        <button className="btn-sm" onClick={onClose}>
          × Tutup
        </button>
      </div>
      <div className="sql-progress-toolbar">
        <select
          aria-label="Pilih assignment"
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
        >
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Cari nama, NPM, atau kelas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn-sm"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading || !assignmentId}
        >
          Refresh
        </button>
      </div>
      <div className="sql-progress-summary">
        <article>
          <b>{students.length}</b>
          <span>Total mahasiswa</span>
        </article>
        <article className="green">
          <b>{summary.complete}</b>
          <span>Selesai</span>
        </article>
        <article className="blue">
          <b>{summary.active}</b>
          <span>Sedang mengerjakan</span>
        </article>
        <article>
          <b>{summary.notStarted}</b>
          <span>Belum mulai</span>
        </article>
      </div>
      {error && <div className="sql-error">{error}</div>}
      {loading ? (
        <div className="sql-empty">Memuat progress…</div>
      ) : (
        <div className="sql-progress-table-wrap">
          <table className="sql-grid sql-progress-table">
            <thead>
              <tr>
                <th>Mahasiswa</th>
                <th>NPM</th>
                <th>Kelas</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Last submit</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length && (
                <tr>
                  <td colSpan="6" className="sql-empty">
                    Tidak ada mahasiswa yang cocok.
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const percent = s.total
                  ? Math.round((s.completed / s.total) * 100)
                  : 0;
                const status =
                  s.completed === 0
                    ? "Belum mulai"
                    : s.completed === s.total
                      ? "Selesai"
                      : "Dikerjakan";
                const statusKey =
                  s.completed === 0
                    ? "not-started"
                    : s.completed === s.total
                      ? "complete"
                      : "in-progress";
                return (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name || "—"}</b>
                    </td>
                    <td>{s.npm}</td>
                    <td>{s.class || "—"}</td>
                    <td>
                      <div className="sql-student-progress">
                        <div>
                          <i style={{ width: `${percent}%` }} />
                        </div>
                        <span>
                          {s.completed}/{s.total} ({percent}%)
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`sql-student-status ${statusKey}`}>
                        {status}
                      </span>
                    </td>
                    <td>{formatDate(s.last_submit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
