import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'

function fmtDate(str) {
  return new Date(str).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Student: own uploads ────────────────────────────────────
function StudentExerciseView({ sectionId, userId }) {
  const [files, setFiles]         = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragover, setDragover]   = useState(false)
  const inputRef = useRef()

  useEffect(() => { loadFiles() }, [sectionId, userId])

  async function loadFiles() {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .order('uploaded_at', { ascending: false })
    setFiles(data ?? [])
  }

  async function uploadFile(file) {
    setUploading(true)
    const path = `${userId}/${sectionId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('exercises').upload(path, file)
    if (error) { alert(error.message); setUploading(false); return }
    await supabase.from('exercises').insert({ user_id: userId, section_id: sectionId, file_name: file.name, file_path: path })
    await loadFiles()
    setUploading(false)
  }

  async function deleteFile(f) {
    if (!confirm(`Hapus file "${f.file_name}"?`)) return
    await Promise.all([
      supabase.storage.from('exercises').remove([f.file_path]),
      supabase.from('exercises').delete().eq('id', f.id),
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

// ── Admin: collapsible per-student view ─────────────────────
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
    const q = supabase
      .from('exercises')
      .select('*')
      .eq('section_id', sectionId)
      .order('uploaded_at', { ascending: false })
    if (selectedStudentId) q.eq('user_id', selectedStudentId)
    q.then(({ data }) => {
      const map = {}
      for (const f of data ?? []) {
        if (!map[f.user_id]) map[f.user_id] = []
        map[f.user_id].push(f)
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
        <StudentExerciseSection
          key={s.id}
          student={s}
          files={filesByUser[s.id] ?? []}
        />
      ))}
      {displayStudents.length === 0 && (
        <div className="empty-state"><p>Tidak ada mahasiswa yang sesuai filter.</p></div>
      )}
    </div>
  )
}

// ── Export ──────────────────────────────────────────────────
export default function ExerciseTab({ sectionId, userId, profile, selectedStudentId, students }) {
  if (profile.is_admin) {
    return <AdminExerciseView sectionId={sectionId} selectedStudentId={selectedStudentId} students={students} />
  }
  return <StudentExerciseView sectionId={sectionId} userId={userId} />
}
