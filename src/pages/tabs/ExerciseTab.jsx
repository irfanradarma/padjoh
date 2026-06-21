import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'
import QuizView from './QuizView'

function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? str : d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Google Sheets panel (section 2 only) ─────────────────────
// Data embedded from IT Governance Audit Program (Responses) form
const SHEET_ROWS = [
  { timestamp: '6/12/2026 10:27:58', npm: '4213250048', url: 'https://drive.google.com/open?id=1QcfvR4Ky5JXO0WMnjgsG3xlpr-LxDMwr' },
  { timestamp: '6/12/2026 22:59:36', npm: '4213250007', url: 'https://drive.google.com/open?id=1eVwSAPo_Yhjlm8jR4UoTXW1PyLs39rIc' },
  { timestamp: '6/13/2026 12:58:25', npm: '4213250131', url: 'https://drive.google.com/open?id=18PvEJZkbvEA8GmrkinyJfoAE_ltPWSaJ' },
  { timestamp: '6/13/2026 14:06:05', npm: '4213250127', url: 'https://drive.google.com/open?id=15atgLmgYUFqvqRPbqCptRqvHQtXsXlp2' },
  { timestamp: '6/13/2026 18:07:09', npm: '4213250173', url: 'https://drive.google.com/open?id=1SjPWAbeqyJZAJcYYt23TLQGsA7zGIcwD' },
  { timestamp: '6/13/2026 19:01:22', npm: '4213250070', url: 'https://drive.google.com/open?id=1b-ev6pO6h_0QRiEKzJpeRYahEn5MNK2A' },
  { timestamp: '6/13/2026 21:29:02', npm: '4213250100', url: 'https://drive.google.com/open?id=1pI6OHFxgFE7yJWzYp-x3sXyD3mEyodP0' },
  { timestamp: '6/13/2026 22:09:23', npm: '4213250001', url: 'https://drive.google.com/open?id=1zfWj-okX8149xO4-Mg4FK7Cv0H88DUKU' },
  { timestamp: '6/13/2026 23:48:02', npm: '4213250095', url: 'https://drive.google.com/open?id=1KpVM3plMdtA-8b_w5NGDzd3Fd_UOuiKS' },
  { timestamp: '6/14/2026 9:04:18',  npm: '4213250174', url: 'https://drive.google.com/open?id=1IpBWs3lMYYoWSDCSvSpPOZQvVLIjdsqT' },
  { timestamp: '6/14/2026 9:12:50',  npm: '4213250049', url: 'https://drive.google.com/open?id=13kPs_yjqP59DYfpW6wYbfga-HtDcBZyu' },
  { timestamp: '6/14/2026 9:51:50',  npm: '4213250013', url: 'https://drive.google.com/open?id=1rhZhdcEK-FmkY-KoU9wMx2UaUANTOJqI' },
  { timestamp: '6/14/2026 10:03:27', npm: '4213250137', url: 'https://drive.google.com/open?id=1-LWzRyuZFC5hJD9WCogKdOToGltSltRG' },
  { timestamp: '6/14/2026 11:06:02', npm: '4213250138', url: 'https://drive.google.com/open?id=1uZ_ogUCay5zt46PUoZIDhRto9On7SBXZ' },
  { timestamp: '6/14/2026 12:50:08', npm: '4213250083', url: 'https://drive.google.com/open?id=1RV6Qk6cu0oHsQtib2pjIdUAj9ToJ_gbj' },
  { timestamp: '6/14/2026 13:30:31', npm: '4213250099', url: 'https://drive.google.com/open?id=1bRciPyHHGCqjjKTPIG8wh8vttOtZ9AWD' },
  { timestamp: '6/14/2026 13:46:22', npm: '4213250151', url: 'https://drive.google.com/open?id=1IQOb8rH7GHTDwLjVs_lu2XC7n-VhIaTy' },
  { timestamp: '6/14/2026 15:21:34', npm: '4213250130', url: 'https://drive.google.com/open?id=1NqZgnZS4Qe3mlO5nTLEP97ohafG9MOvs' },
  { timestamp: '6/14/2026 16:12:28', npm: '4213250142', url: 'https://drive.google.com/open?id=1E5A9PrQzu-uZ0mL_DDTJE28bDrGWyYAJ' },
  { timestamp: '6/14/2026 16:15:29', npm: '4213250142', url: 'https://drive.google.com/open?id=1msMKQuYQHn21WZHZqlPP6x1dO58F8wFz' },
  { timestamp: '6/14/2026 17:39:54', npm: '4213250126', url: 'https://drive.google.com/open?id=1acQJv8Z_-xY4QvYhyVuUIFF13VKm8k6Z' },
  { timestamp: '6/14/2026 17:45:34', npm: '4213250008', url: 'https://drive.google.com/open?id=1kQ1Kei6TH3CkUCdaF-99yQtBCaOcsxpd' },
  { timestamp: '6/14/2026 18:14:09', npm: '4213250143', url: 'https://drive.google.com/open?id=1HjHNC73GYI4OB_m1w1qT57DBHhaguWSq' },
  { timestamp: '6/14/2026 18:59:18', npm: '4213250111', url: 'https://drive.google.com/open?id=1rC0e2X3AO_vLvncz2VIndnJlyYatx95L' },
  { timestamp: '6/14/2026 18:59:28', npm: '4213250129', url: 'https://drive.google.com/open?id=1rRahDVAdYlrN1v-NTzLZ6kEPxfzINPI7' },
  { timestamp: '6/14/2026 19:02:03', npm: '4213250034', url: 'https://drive.google.com/open?id=1N32-XLl7bWGGSOEb7tGXtTCa44YvVunT' },
  { timestamp: '6/14/2026 19:41:18', npm: '4213250115', url: 'https://drive.google.com/open?id=1H7UEaMRuyExVTAneavKwHbT07gqFrxBP' },
  { timestamp: '6/14/2026 20:29:38', npm: '4213250005', url: 'https://drive.google.com/open?id=1A4Z5OFmwmE3N4CsqSomfSALwwoO_U8kj' },
  { timestamp: '6/14/2026 20:58:10', npm: '4213250138', url: 'https://drive.google.com/open?id=1k0rJWVfOFaxggKAVWqV5Tqb8Kasx_jfb' },
  { timestamp: '6/14/2026 21:11:39', npm: '4213250121', url: 'https://drive.google.com/open?id=16HxQdv-sJpCNwcJEOW8W2Hglj0HLPQ-y' },
  { timestamp: '6/14/2026 21:24:43', npm: '4213250082', url: 'https://drive.google.com/open?id=1sMFxriNwDvpzSt0HP_iBZW8fOAUe8NTo' },
  { timestamp: '6/14/2026 21:38:14', npm: '4213250124', url: 'https://drive.google.com/open?id=1EegzEfeT1PJHc5yAMiJrN_vNCozNIMiO' },
  { timestamp: '6/14/2026 21:38:38', npm: '4213250152', url: 'https://drive.google.com/open?id=1WDbm58HIHMJQCaPZTg72hCqY561-BGH7' },
  { timestamp: '6/14/2026 21:55:32', npm: '4213250134', url: 'https://drive.google.com/open?id=1uZ9kTYMssp7qiWjAh3_O_Lov1KU7u5JB' },
  { timestamp: '6/14/2026 22:21:03', npm: '4213250136', url: 'https://drive.google.com/open?id=1JghDp0r1kOjCGlu766JuZngkKUTBEYcW' },
  { timestamp: '6/14/2026 22:25:06', npm: '4213250093', url: 'https://drive.google.com/open?id=1Ymn0z3s_Dr9mt_xXwjbuO6pCOhgiuIPK' },
  { timestamp: '6/14/2026 22:50:48', npm: '4213250096', url: 'https://drive.google.com/open?id=1u4eLS7ESFO2HHfVX_d7xxes7T-fPA89S' },
  { timestamp: '6/14/2026 22:59:57', npm: '4213250050', url: 'https://drive.google.com/open?id=1OAiZEkqh11Db9FfYAKcJ2nE2TCeM3PQW' },
  { timestamp: '6/14/2026 23:03:55', npm: '4213250148', url: 'https://drive.google.com/open?id=1pj1jYXdVpImewIeCBgfp0725rbxTnxAd' },
  { timestamp: '6/14/2026 23:11:45', npm: '4213250133', url: 'https://drive.google.com/open?id=1cTaUIUNjmlL0qMGbKoF8q-ogCsMk1KNN' },
  { timestamp: '6/14/2026 23:12:40', npm: '4213250150', url: 'https://drive.google.com/open?id=1CDkcd1fkJZaALPCMMgTe8QDNSMxQX0vu' },
  { timestamp: '6/14/2026 23:19:12', npm: '4213250026', url: 'https://drive.google.com/open?id=1s3SCvPViEdj-kJfJD6rzsTWOpH7PtxX_' },
  { timestamp: '6/14/2026 23:28:23', npm: '4213250146', url: 'https://drive.google.com/open?id=1VCbn6Dg5zUuM7_qK0k1fZ64PRnS1oT6A' },
  { timestamp: '6/14/2026 23:40:41', npm: '4213250023', url: 'https://drive.google.com/open?id=1Wl4h1V1lIOH7a_iUMtARk2mbHc3wkEr9' },
  { timestamp: '6/14/2026 23:49:13', npm: '4213250141', url: 'https://drive.google.com/open?id=1SE1SAFqt179GJ6a-NMI2ySiOpzc4NGIX' },
  { timestamp: '6/14/2026 23:55:26', npm: '4213250120', url: 'https://drive.google.com/open?id=1MTMSH6DpGwu4gHa6V_AQLMa509Ncq_ZU' },
  { timestamp: '6/14/2026 23:57:30', npm: '4213250135', url: 'https://drive.google.com/open?id=19WlYH7_N7GGocgunEoDvNXJzP3Neb9Zt' },
]

function drivePreview(url) {
  if (!url) return null
  const m = url.match(/\/file\/d\/([^\/\?&]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  const m2 = url.match(/[?&]id=([^&]+)/)
  if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`
  return null
}

function useSheetData() {
  return { rows: SHEET_ROWS, err: null }
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

// ── Admin: quiz section ───────────────────────────────────────
function AdminQuizSection({ sectionId, students, onOpenSession }) {
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [openingFor, setOpeningFor]   = useState(null)  // 'deployId/class'

  useEffect(() => {
    supabase.rpc('get_section_quiz_deployments', { p_section_id: sectionId })
      .then(({ data }) => { setDeployments(data ?? []); setLoading(false) })
  }, [sectionId])

  async function openCheckin(deploymentId, cls) {
    const key = `${deploymentId}/${cls}`
    setOpeningFor(key)
    const { data: sessionId, error } = await supabase.rpc('admin_open_checkin', {
      p_deployment_id: deploymentId, p_class: cls,
    })
    setOpeningFor(null)
    if (error) { alert(error.message); return }
    // Refresh deployment list then open
    const { data } = await supabase.rpc('get_section_quiz_deployments', { p_section_id: sectionId })
    setDeployments(data ?? [])
    const dep = (data ?? []).find(d => d.deployment_id === deploymentId)
    onOpenSession(sessionId, dep?.title ?? '', false, deploymentId)
  }

  const classes = [...new Set((students ?? []).map(s => s.class).filter(Boolean))].sort()

  if (loading) return null
  if (deployments.length === 0) return null

  return (
    <div className="quiz-section">
      <div className="quiz-section-title">🎯 Kuis</div>
      {deployments.map(dep => (
        <div key={dep.deployment_id} className="quiz-deploy-card">
          <div className="quiz-deploy-header">
            <span className="quiz-deploy-title">{dep.title}</span>
            <span className="quiz-deploy-meta">{Math.round(dep.time_limit / 60)} mnt{dep.tournament ? ' · 🏆 Turnamen' : ''}</span>
          </div>
          <div className="quiz-class-rows">
            {classes.map(cls => {
              const session = (dep.sessions ?? []).find(s => s.class === cls)
              const key = `${dep.deployment_id}/${cls}`
              return (
                <div key={cls} className="quiz-class-row">
                  <span className="quiz-class-name">Kelas {cls}</span>
                  {session && (
                    <span className={`quiz-status-badge qsb-${session.status}`}>
                      {session.status === 'checkin' ? 'Check-in' : session.status === 'active' ? '🔴 Berlangsung' : '✅ Selesai'}
                    </span>
                  )}
                  {session && session.status === 'checkin' && (
                    <span className="quiz-checkin-count">{session.checkin_count} check-in</span>
                  )}
                  {session ? (
                    <button
                      className="btn-sm btn-primary"
                      onClick={() => onOpenSession(session.session_id, dep.title, false, dep.deployment_id)}
                    >Kelola</button>
                  ) : (
                    <button
                      className="btn-sm"
                      onClick={() => openCheckin(dep.deployment_id, cls)}
                      disabled={openingFor === key}
                    >{openingFor === key ? '…' : 'Buka Check-in'}</button>
                  )}
                </div>
              )
            })}
            {classes.length === 0 && (
              <div className="quiz-no-class">Belum ada mahasiswa di sesi ini.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Student: quiz section ─────────────────────────────────────
function StudentQuizSection({ sectionId, onOpenSession }) {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_section_quizzes', { p_section_id: sectionId })
      .then(({ data }) => { setQuizzes(data ?? []); setLoading(false) })
  }, [sectionId])

  if (loading) return null
  if (quizzes.length === 0) return null

  return (
    <div className="quiz-section">
      <div className="quiz-section-title">🎯 Kuis</div>
      {quizzes.map(q => (
        <div key={q.deployment_id} className="quiz-student-card">
          <div className="quiz-student-info">
            <div className="quiz-student-title">{q.title}</div>
            <div className="quiz-student-meta">
              {Math.round(q.time_limit / 60)} menit
              {q.tournament ? ' · 🏆 Turnamen' : ''}
              {q.my_result && ` · Skor: ${Number(q.my_result.total).toFixed(1)} (#${q.my_result.rank})`}
            </div>
          </div>
          <div className="quiz-student-right">
            {q.status === 'not_open' && (
              <span className="quiz-status-badge qsb-not_open">Belum dibuka</span>
            )}
            {q.status === 'checkin' && !q.is_checked_in && (
              <button
                className="btn-sm btn-primary"
                onClick={() => onOpenSession(q.session_id, q.title, q.has_password, q.deployment_id, {
                  initialStatus: 'checkin', initialCheckedIn: false,
                  timeLimitSec: q.time_limit, isTournament: q.tournament,
                })}
              >Masuk Kuis</button>
            )}
            {q.status === 'checkin' && q.is_checked_in && (
              <span className="quiz-status-badge qsb-checkin">Menunggu mulai…</span>
            )}
            {q.status === 'active' && (
              <button
                className="btn-sm btn-primary"
                onClick={() => onOpenSession(q.session_id, q.title, false, q.deployment_id, {
                  initialStatus: 'active', initialCheckedIn: true,
                  startedAt: q.started_at, timeLimitSec: q.time_limit, isTournament: q.tournament,
                })}
              >▶ Lanjutkan</button>
            )}
            {q.status === 'finished' && (
              <button
                className="btn-sm"
                onClick={() => onOpenSession(q.session_id, q.title, false, q.deployment_id, {
                  initialStatus: 'finished', initialCheckedIn: true,
                  timeLimitSec: q.time_limit, isTournament: q.tournament,
                })}
              >Lihat Hasil</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Export ──────────────────────────────────────────────────
export default function ExerciseTab({ sectionId, userId, profile, selectedStudentId, students }) {
  const isSection2 = sectionId === 2
  const [quizView, setQuizView] = useState(null)

  if (quizView) {
    return (
      <QuizView
        sessionId={quizView.sessionId}
        quizTitle={quizView.quizTitle}
        hasPassword={quizView.hasPassword}
        profile={profile}
        initialStatus={quizView.initialStatus}
        initialCheckedIn={quizView.initialCheckedIn}
        startedAt={quizView.startedAt}
        timeLimitSec={quizView.timeLimitSec}
        isTournament={quizView.isTournament}
        onBack={() => setQuizView(null)}
      />
    )
  }

  function openSession(sessionId, quizTitle, hasPassword, deploymentId, extra = {}) {
    setQuizView({ sessionId, quizTitle, hasPassword, deploymentId, ...extra })
  }

  if (profile.is_admin) {
    return (
      <div>
        <AdminQuizSection sectionId={sectionId} students={students} onOpenSession={openSession} />
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
      <StudentQuizSection sectionId={sectionId} onOpenSession={openSession} />
      {isSection2 && <StudentSheetExercise profile={profile} />}
      <StudentExerciseView sectionId={sectionId} userId={userId} />
    </div>
  )
}
