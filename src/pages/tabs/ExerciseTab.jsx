import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'

function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? str : d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Google Sheets panel (section 2 only) ─────────────────────
const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1J-gI4RSr2eZRdA7xj7vHZ9uXXLCDwyXIM-N1oSH_6_Q/export?format=csv&gid=0'

function parseCSV(text) {
  const rows = []
  for (const line of text.trim().split('\n').slice(1)) {
    if (!line.trim()) continue
    // Handle quoted CSV fields
    const cols = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())
    const npm = (cols[1] ?? '').trim()
    const url = (cols[2] ?? '').trim()
    if (npm) rows.push({ timestamp: cols[0] ?? '', npm, url })
  }
  return rows
}

function drivePreview(url) {
  if (!url) return null
  const m = url.match(/\/file\/d\/([^\/\?&]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  const m2 = url.match(/[?&]id=([^&]+)/)
  if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`
  return null
}

function useSheetData() {
  const [rows, setRows] = useState(null)
  const [err, setErr]   = useState(null)
  useEffect(() => {
    fetch(SHEET_CSV)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() })
      .then(text => setRows(parseCSV(text)))
      .catch(e => setErr(e.message))
  }, [])
  return { rows, err }
}

function PdfPreview({ url, label }) {
  const [fullscreen, setFullscreen] = useState(false)
  const preview = drivePreview(url)
  if (!preview) return (
    <a href={url} target="_blank" rel="noreferrer" className="sheet-file-link">↗ Buka dokumen</a>
  )
  return (
    <div className={`sheet-pdf-wrap${fullscreen ? ' sheet-pdf-fullscreen' : ''}`}>
      <div className="sheet-pdf-toolbar">
        <span className="sheet-pdf-label">{label}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={url} target="_blank" rel="noreferrer" className="btn-sm">↗ Tab baru</a>
          <button className="btn-sm" onClick={() => setFullscreen(x => !x)}>
            {fullscreen ? '⊡ Kecilkan' : '⊞ Perbesar'}
          </button>
        </div>
      </div>
      <iframe
        src={preview}
        className="sheet-pdf-frame"
        title={label}
        allowFullScreen
      />
    </div>
  )
}

function StudentSheetExercise({ profile }) {
  const { rows, err } = useSheetData()
  if (err)   return <div className="sheet-status sheet-err">⚠ Gagal memuat data Google Forms: {err}</div>
  if (!rows) return <div className="sheet-status">Memuat data Google Forms…</div>

  const entry = rows.find(r => r.npm === profile.npm)

  return (
    <div className="sheet-panel">
      <div className="sheet-panel-header">
        <span className="sheet-panel-title">📋 Laporan dari Google Forms</span>
        <span className="sheet-panel-sub">Sesi 2 — IT Governance Audit</span>
      </div>
      {entry ? (
        <>
          <div className="sheet-meta">
            🕐 Dikumpulkan: <strong>{fmtDate(entry.timestamp)}</strong>
          </div>
          <PdfPreview url={entry.url} label={`Laporan ${profile.npm}`} />
        </>
      ) : (
        <div className="sheet-not-found">
          NPM <strong>{profile.npm}</strong> tidak ditemukan dalam data Google Forms.
          Hubungi dosen jika Anda sudah mengumpulkan.
        </div>
      )}
    </div>
  )
}

function AdminSheetRow({ row, studentName, open, onToggle }) {
  return (
    <div className={`student-section${open ? ' open' : ''}`}>
      <div className="student-section-header" onClick={onToggle}>
        <div>
          <div className="student-section-name">{studentName ?? row.npm}</div>
          <div className="student-section-meta">{row.npm} · {fmtDate(row.timestamp)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {row.url
            ? <span style={{ fontSize: 11, color: 'var(--accent)' }}>Ada laporan</span>
            : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Tanpa file</span>
          }
          <span className="student-section-chevron">›</span>
        </div>
      </div>
      {open && (
        <div className="student-section-body">
          {row.url
            ? <PdfPreview url={row.url} label={`Laporan ${row.npm}`} />
            : <div className="student-section-empty">Tidak ada URL dokumen.</div>
          }
        </div>
      )}
    </div>
  )
}

function AdminSheetExercise({ students, selectedStudentId }) {
  const { rows, err } = useSheetData()
  const [openIdx, setOpenIdx] = useState(null)

  if (err)   return <div className="sheet-status sheet-err">⚠ Gagal memuat data Google Forms: {err}</div>
  if (!rows) return <div className="sheet-status">Memuat data Google Forms…</div>

  const npmToName = {}
  for (const s of students) npmToName[s.npm] = s.name

  const selectedNpm = students.find(s => s.id === selectedStudentId)?.npm
  const display = selectedStudentId ? rows.filter(r => r.npm === selectedNpm) : rows

  return (
    <div className="sheet-panel">
      <div className="sheet-panel-header">
        <span className="sheet-panel-title">📋 Laporan dari Google Forms</span>
        <span className="sheet-panel-sub">{rows.length} entri</span>
      </div>
      <div className="admin-content-list" style={{ marginTop: 12 }}>
        {display.map((row, i) => (
          <AdminSheetRow
            key={i}
            row={row}
            studentName={npmToName[row.npm]}
            open={openIdx === i}
            onToggle={() => setOpenIdx(openIdx === i ? null : i)}
          />
        ))}
        {display.length === 0 && (
          <div className="empty-state"><p>Tidak ada entri yang sesuai filter.</p></div>
        )}
      </div>
    </div>
  )
}

// ── Regular upload: student own files ────────────────────────
function StudentExerciseView({ sectionId, userId }) {
  const [files, setFiles]         = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragover, setDragover]   = useState(false)
  const inputRef = useRef()

  useEffect(() => { loadFiles() }, [sectionId, userId])

  async function loadFiles() {
    const { data } = await supabase.rpc('get_my_exercises', { p_section_id: sectionId })
    setFiles(data ?? [])
  }

  async function uploadFile(file) {
    setUploading(true)
    const path = `${userId}/${sectionId}/${Date.now()}_${file.name}`
    const { error: storageErr } = await supabase.storage.from('exercises').upload(path, file)
    if (storageErr) { alert(storageErr.message); setUploading(false); return }
    const { error: dbErr } = await supabase.rpc('save_exercise', {
      p_section_id: sectionId, p_file_name: file.name, p_file_path: path,
    })
    if (dbErr) { alert(dbErr.message); setUploading(false); return }
    await loadFiles()
    setUploading(false)
  }

  async function deleteFile(f) {
    if (!confirm(`Hapus file "${f.file_name}"?`)) return
    await Promise.all([
      supabase.storage.from('exercises').remove([f.file_path]),
      supabase.rpc('delete_exercise', { p_id: f.id }),
    ])
    setFiles(prev => prev.filter(x => x.id !== f.id))
  }

  async function downloadFile(f) {
    const { data } = await supabase.storage.from('exercises').createSignedUrl(f.file_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function onDrop(e) {
    e.preventDefault(); setDragover(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div>
      <div
        className={`upload-zone${dragover ? ' dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current.click()}
      >
        <div className="upload-icon">{uploading ? '⏳' : '📁'}</div>
        <div className="upload-text">{uploading ? 'Mengunggah…' : 'Klik atau seret file ke sini'}</div>
        <div className="upload-hint">Semua jenis file diterima</div>
        <input
          ref={inputRef} type="file" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); e.target.value = '' }}
        />
      </div>

      {files.length === 0 && !uploading ? (
        <div className="empty-state" style={{ paddingTop: 28 }}>
          <p>Belum ada file yang diunggah untuk sesi ini.</p>
        </div>
      ) : (
        <div className="file-list">
          {files.map(f => (
            <div key={f.id} className="file-item">
              <div className="file-icon">📄</div>
              <div className="file-info">
                <div className="file-name">{f.file_name}</div>
                <div className="file-meta">{fmtDate(f.uploaded_at)}</div>
              </div>
              <div className="file-actions">
                <button className="btn-sm" onClick={() => downloadFile(f)}>Unduh</button>
                <button className="btn-sm btn-danger" onClick={() => deleteFile(f)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Admin: collapsible per-student regular uploads ────────────
function StudentExerciseSection({ student, files }) {
  const [open, setOpen] = useState(false)

  async function downloadFile(f) {
    const { data } = await supabase.storage.from('exercises').createSignedUrl(f.file_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className={`student-section${open ? ' open' : ''}`}>
      <div className="student-section-header" onClick={() => setOpen(x => !x)}>
        <div>
          <div className="student-section-name">{student.name}</div>
          <div className="student-section-meta">{student.npm} · {student.class}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {files.length > 0
            ? <span style={{ fontSize: 11, color: 'var(--accent)' }}>{files.length} file</span>
            : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Belum ada file</span>
          }
          <span className="student-section-chevron">›</span>
        </div>
      </div>
      {open && (
        <div className="student-section-body">
          {files.length === 0 ? (
            <div className="student-section-empty">Belum ada file yang diunggah.</div>
          ) : (
            <div className="file-list" style={{ marginTop: 0 }}>
              {files.map(f => (
                <div key={f.id} className="file-item">
                  <div className="file-icon">📄</div>
                  <div className="file-info">
                    <div className="file-name">{f.file_name}</div>
                    <div className="file-meta">{fmtDate(f.uploaded_at)}</div>
                  </div>
                  <button className="btn-sm" onClick={() => downloadFile(f)}>Unduh</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AdminExerciseView({ sectionId, selectedStudentId, students }) {
  const [filesByUser, setFilesByUser] = useState({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.rpc('get_section_exercises', { p_section_id: sectionId }).then(({ data }) => {
      const map = {}
      for (const f of data ?? []) {
        if (!selectedStudentId || f.user_id === selectedStudentId) {
          if (!map[f.user_id]) map[f.user_id] = []
          map[f.user_id].push(f)
        }
      }
      setFilesByUser(map)
      setLoading(false)
    })
  }, [sectionId, selectedStudentId])

  const displayStudents = selectedStudentId
    ? students.filter(s => s.id === selectedStudentId)
    : students

  if (loading) return <div className="empty-state"><p>Memuat…</p></div>

  return (
    <div className="admin-content-list">
      {displayStudents.map(s => (
        <StudentExerciseSection key={s.id} student={s} files={filesByUser[s.id] ?? []} />
      ))}
      {displayStudents.length === 0 && (
        <div className="empty-state"><p>Tidak ada mahasiswa yang sesuai filter.</p></div>
      )}
    </div>
  )
}

// ── Export ──────────────────────────────────────────────────
export default function ExerciseTab({ sectionId, userId, profile, selectedStudentId, students }) {
  const isSection2 = sectionId === 2

  if (profile.is_admin) {
    return (
      <div>
        {isSection2 && (
          <AdminSheetExercise students={students} selectedStudentId={selectedStudentId} />
        )}
        {!isSection2 && (
          <AdminExerciseView sectionId={sectionId} selectedStudentId={selectedStudentId} students={students} />
        )}
      </div>
    )
  }

  return (
    <div>
      {isSection2 && <StudentSheetExercise profile={profile} />}
      <StudentExerciseView sectionId={sectionId} userId={userId} />
    </div>
  )
}
