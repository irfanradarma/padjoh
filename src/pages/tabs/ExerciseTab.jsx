import { useEffect, useRef, useState, Fragment } from 'react'
import { supabase } from '../../supabaseClient'
import { SECTIONS } from '../../sections'
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
  const [myGrade, setMyGrade]     = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragover, setDragover]   = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    loadFiles()
    supabase.rpc('get_my_exercise_grade', { p_section_id: sectionId })
      .then(({ data }) => setMyGrade(data ?? null))
  }, [sectionId, userId])

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
      {myGrade?.grade != null && (
        <div className="ex-my-grade-banner">
          <span className="ex-my-grade-label">Nilai Latihan Anda:</span>
          <span className="gr-grade-chip">{myGrade.grade}</span>
          {myGrade.notes && <span className="ex-my-grade-notes">{myGrade.notes}</span>}
        </div>
      )}

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

// ── Grading: rubric editor ────────────────────────────────────
const DEFAULT_EXERCISE_RUBRIC = {
  criteria: [
    { name: 'Kelengkapan',     max_score: 30, description: 'Kelengkapan tugas sesuai instruksi dan cakupan topik' },
    { name: 'Pemahaman',       max_score: 35, description: 'Kedalaman pemahaman konsep IS Audit yang relevan' },
    { name: 'Penerapan',       max_score: 25, description: 'Kemampuan menerapkan konsep pada kasus atau contoh nyata' },
    { name: 'Kerapian',        max_score: 10, description: 'Sistematika penyajian, kerapian dokumen, dan tata bahasa' },
  ],
}

function RubricEditor({ rubric, onChange }) {
  const total = rubric.criteria.reduce((s, c) => s + Number(c.max_score || 0), 0)

  function update(i, field, val) {
    onChange({
      ...rubric,
      criteria: rubric.criteria.map((c, j) =>
        j === i ? { ...c, [field]: field === 'max_score' ? Number(val) : val } : c
      ),
    })
  }

  return (
    <div className="gr-rubric-editor">
      <div className="gr-rubric-total-row">
        <span className="gr-rubric-sub">Edit rubrik sebelum menilai. Berlaku untuk semua mahasiswa di sesi ini.</span>
        <span className={`gr-rubric-total${total !== 100 ? ' gr-rubric-warn' : ''}`}>Total: {total} / 100</span>
      </div>
      {rubric.criteria.map((c, i) => (
        <div key={i} className="gr-rubric-row">
          <div className="gr-rubric-top">
            <input className="input gr-rubric-name" value={c.name}
              onChange={e => update(i, 'name', e.target.value)} placeholder="Nama kriteria" />
            <div className="gr-rubric-score-wrap">
              <input type="number" min="0" max="100" className="input gr-rubric-score"
                value={c.max_score} onChange={e => update(i, 'max_score', e.target.value)} />
              <span className="gr-rubric-pts">pts</span>
            </div>
          </div>
          <input className="input gr-rubric-desc" value={c.description}
            onChange={e => update(i, 'description', e.target.value)} placeholder="Deskripsi kriteria" />
        </div>
      ))}
    </div>
  )
}

// ── Grading: build automatic AI context from submission metadata ──
function buildAutoContext(files, sheetRow) {
  if (sheetRow) {
    return `Mahasiswa mengumpulkan laporan melalui Google Forms pada ${fmtDate(sheetRow.timestamp)}. Tautan dokumen: ${sheetRow.url || '(tidak ada)'}.`
  }
  if (!files || files.length === 0) return ''
  const list = files.map(f => `- ${f.file_name} (diunggah ${fmtDate(f.uploaded_at)})`).join('\n')
  return `Mahasiswa mengunggah ${files.length} file:\n${list}`
}

function round1(n) { return Math.round(n * 10) / 10 }

// ── Grading: inline rendering for a single file, by type ──────
function classifyFile(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) return 'office'
  if (['txt', 'csv', 'md', 'json', 'log'].includes(ext)) return 'text'
  return 'other'
}

function InlineFilePreview({ file, url }) {
  const kind = classifyFile(file.file_name)
  const [textContent, setTextContent] = useState(null)
  const [textErr, setTextErr]         = useState(false)

  useEffect(() => {
    if (kind !== 'text' || !url) return
    let cancelled = false
    setTextContent(null); setTextErr(false)
    fetch(url).then(r => r.text()).then(t => { if (!cancelled) setTextContent(t) })
      .catch(() => { if (!cancelled) setTextErr(true) })
    return () => { cancelled = true }
  }, [kind, url])

  if (!url) return <div className="ex-tbl-file-loading">Memuat pratinjau…</div>
  if (kind === 'image') return <img src={url} alt={file.file_name} className="ex-tbl-file-img" />
  if (kind === 'pdf')   return <iframe src={url} className="ex-tbl-file-frame" title={file.file_name} />
  if (kind === 'office') {
    return (
      <iframe
        src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
        className="ex-tbl-file-frame"
        title={file.file_name}
      />
    )
  }
  if (kind === 'text') {
    if (textErr) return <div className="ex-tbl-file-unsupported">Gagal memuat isi file. Gunakan tombol "↗ Buka" di atas.</div>
    if (textContent == null) return <div className="ex-tbl-file-loading">Memuat isi file…</div>
    return <pre className="ex-tbl-file-text">{textContent}</pre>
  }
  return (
    <div className="ex-tbl-file-unsupported">
      Format file ini tidak dapat ditampilkan langsung di sini. Gunakan tombol "↗ Buka" di atas.
    </div>
  )
}

// ── Grading: submission preview (accordion body) ──────────────
function SubmissionPreview({ files, isSection2, sheetRow }) {
  const [signedUrls, setSignedUrls] = useState({})

  useEffect(() => {
    if (isSection2 || !files || files.length === 0) { setSignedUrls({}); return }
    let cancelled = false
    Promise.all(files.map(async f => {
      const { data } = await supabase.storage.from('exercises').createSignedUrl(f.file_path, 600)
      return [f.id, data?.signedUrl]
    })).then(pairs => { if (!cancelled) setSignedUrls(Object.fromEntries(pairs)) })
    return () => { cancelled = true }
  }, [files, isSection2])

  if (isSection2) {
    return sheetRow
      ? <PdfPreview url={sheetRow.url} label={`Laporan ${sheetRow.npm}`} />
      : <div className="student-section-empty">Belum ada laporan Google Forms.</div>
  }
  if (!files || files.length === 0) {
    return <div className="student-section-empty">Belum ada file yang diunggah.</div>
  }
  return (
    <div className="ex-tbl-files">
      {files.map(f => {
        const url = signedUrls[f.id]
        return (
          <div key={f.id} className="ex-tbl-file-block">
            <div className="ex-tbl-file-head">
              <span className="file-name">{f.file_name}</span>
              <span className="file-meta">{fmtDate(f.uploaded_at)}</span>
              {url && <a href={url} target="_blank" rel="noreferrer" className="btn-sm">↗ Buka</a>}
            </div>
            <InlineFilePreview file={f} url={url} />
          </div>
        )
      })}
    </div>
  )
}

// ── Admin: grading table (spreadsheet-style, dynamic rubric columns) ──
function AdminGradingTable({ sectionId, sectionTitle, students, selectedStudentId, isSection2 }) {
  const [grades, setGrades]             = useState({})
  const [rubric, setRubric]             = useState(DEFAULT_EXERCISE_RUBRIC)
  const [rubricOpen, setRubricOpen]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const [filesByUser, setFilesByUser]   = useState({})
  const [filesLoading, setFilesLoading] = useState(!isSection2)

  const [classFilter, setClassFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId]     = useState(null)

  const [edits, setEdits]                   = useState({}) // studentId -> string[]
  const [notesEdits, setNotesEdits]         = useState({}) // studentId -> string
  const [aiContextEdits, setAiContextEdits] = useState({}) // studentId -> string

  const [savingRow, setSavingRow]         = useState(null)
  const [aiRowBusy, setAiRowBusy]         = useState(null)
  const [batchBusy, setBatchBusy]         = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })

  useEffect(() => { loadGrades() }, [sectionId])

  useEffect(() => {
    if (isSection2) { setFilesByUser({}); setFilesLoading(false); return }
    setFilesLoading(true)
    supabase.rpc('get_section_exercises', { p_section_id: sectionId }).then(({ data }) => {
      const map = {}
      for (const f of (data ?? [])) {
        if (!map[f.user_id]) map[f.user_id] = []
        map[f.user_id].push(f)
      }
      setFilesByUser(map)
      setFilesLoading(false)
    })
  }, [sectionId, isSection2])

  async function loadGrades() {
    setLoading(true)
    const { data } = await supabase.rpc('admin_get_exercise_grades', { p_section_id: sectionId })
    const map = {}
    for (const g of (data ?? [])) map[g.user_id] = g
    setGrades(map)
    setLoading(false)
  }

  function scoresFor(studentId) {
    const g = grades[studentId]
    let parsed = null
    try { if (g?.explanation) parsed = JSON.parse(g.explanation) } catch {}
    if (parsed?.scores) {
      return rubric.criteria.map(c => {
        const match = parsed.scores.find(s => s.criterion === c.name)
        return match?.score != null ? String(match.score) : ''
      })
    }
    return rubric.criteria.map(() => '')
  }

  function cellValue(studentId, i) {
    const arr = edits[studentId] ?? scoresFor(studentId)
    return arr[i] ?? ''
  }

  function handleCellChange(studentId, i, val) {
    setEdits(prev => {
      const current = prev[studentId] ?? scoresFor(studentId)
      const next = [...current]
      next[i] = val
      return { ...prev, [studentId]: next }
    })
  }

  function displayNotes(studentId) {
    if (notesEdits[studentId] !== undefined) return notesEdits[studentId]
    return grades[studentId]?.notes ?? ''
  }

  function computeTotal(studentId) {
    const arr = edits[studentId]
    if (arr) return round1(arr.reduce((sum, v) => sum + (parseFloat(v) || 0), 0))
    return grades[studentId]?.grade ?? null
  }

  async function commitRow(studentId, overrideScores, overrideNotes) {
    const scores = overrideScores ?? edits[studentId] ?? scoresFor(studentId)
    const notes  = overrideNotes  ?? notesEdits[studentId] ?? (grades[studentId]?.notes ?? '')
    const total  = round1(scores.reduce((sum, v) => sum + (parseFloat(v) || 0), 0))
    setSavingRow(studentId)
    const explanation = JSON.stringify({
      scores: rubric.criteria.map((c, i) => ({
        criterion: c.name, score: parseFloat(scores[i]) || 0, max_score: c.max_score, comment: '',
      })),
      total_score: total,
      summary: notes,
    })
    const { error } = await supabase.rpc('admin_save_exercise_grade', {
      p_user_id: studentId, p_section_id: sectionId,
      p_grade: total, p_notes: notes || null,
      p_rubric: rubric, p_explanation: explanation,
    })
    setSavingRow(null)
    if (error) { alert(error.message); throw new Error(error.message) }
    setGrades(prev => ({
      ...prev,
      [studentId]: { user_id: studentId, grade: total, notes, rubric, explanation, graded_at: new Date().toISOString() },
    }))
    setEdits(prev => { if (!(studentId in prev)) return prev; const n = { ...prev }; delete n[studentId]; return n })
    setNotesEdits(prev => { if (!(studentId in prev)) return prev; const n = { ...prev }; delete n[studentId]; return n })
  }

  function hasSubmission(studentId) {
    if (isSection2) {
      const npm = students.find(s => s.id === studentId)?.npm
      return SHEET_ROWS.some(r => r.npm === npm && r.url)
    }
    return (filesByUser[studentId]?.length ?? 0) > 0
  }

  async function assessStudentWithAI(studentId) {
    const files = filesByUser[studentId] ?? []
    const npm = students.find(s => s.id === studentId)?.npm
    const sheetRow = isSection2 ? SHEET_ROWS.find(r => r.npm === npm) : null
    const context = (aiContextEdits[studentId] ?? '').trim() || buildAutoContext(files, sheetRow)
    if (!context) throw new Error('Belum ada file/laporan untuk dinilai AI.')
    const { data, error } = await supabase.functions.invoke('assess-exercise', {
      body: { rubric, submission_context: context, section_title: sectionTitle },
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    const scoreArr = rubric.criteria.map(c => {
      const match = (data.scores ?? []).find(s => s.criterion === c.name)
      return match?.score != null ? String(match.score) : '0'
    })
    await commitRow(studentId, scoreArr, data.summary ?? '')
  }

  async function runRowAI(studentId) {
    setAiRowBusy(studentId)
    try { await assessStudentWithAI(studentId) }
    catch (ex) { alert(`Gagal menilai dengan AI: ${ex.message}`) }
    setAiRowBusy(null)
  }

  async function assessAllAI() {
    const targets = filteredStudents.filter(s => hasSubmission(s.id))
    if (targets.length === 0) { alert('Tidak ada mahasiswa dengan submission pada filter saat ini.'); return }
    if (!confirm(`Nilai ${targets.length} mahasiswa dengan AI sekaligus? Nilai yang sudah ada akan ditimpa.`)) return
    setBatchBusy(true)
    setBatchProgress({ done: 0, total: targets.length })
    const failures = []
    for (const s of targets) {
      try { await assessStudentWithAI(s.id) }
      catch (ex) { failures.push(`${s.name}: ${ex.message}`) }
      setBatchProgress(p => ({ done: p.done + 1, total: p.total }))
    }
    setBatchBusy(false)
    if (failures.length > 0) alert(`Selesai dengan ${failures.length} kegagalan:\n${failures.join('\n')}`)
  }

  const classes = [...new Set(students.map(s => s.class).filter(Boolean))].sort()

  const baseStudents = selectedStudentId ? students.filter(s => s.id === selectedStudentId) : students
  const filteredStudents = baseStudents.filter(s => {
    if (classFilter && s.class !== classFilter) return false
    if (statusFilter === 'submitted' && !hasSubmission(s.id)) return false
    if (statusFilter === 'missing' && hasSubmission(s.id)) return false
    return true
  })

  const gradedCount = filteredStudents.filter(s => grades[s.id]?.grade != null).length
  const totalCols = 2 + rubric.criteria.length + 2

  return (
    <div className="ex-grading-section">
      <div className="ex-grading-header">
        <span className="ex-grading-title">🎯 Penilaian Latihan</span>
        <span className="ex-grading-count">{gradedCount} / {filteredStudents.length} sudah dinilai</span>
      </div>

      <div className="gr-rubric-section">
        <button className="gr-rubric-toggle" onClick={() => setRubricOpen(x => !x)}>
          📋 Rubrik Penilaian ({rubric.criteria.length} parameter) {rubricOpen ? '▲' : '▼'}
        </button>
        {rubricOpen && (
          <div className="gr-rubric-body">
            <RubricEditor rubric={rubric} onChange={setRubric} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-sm" onClick={() => setRubric(DEFAULT_EXERCISE_RUBRIC)}>↺ Reset ke Default</button>
              <button className="btn-sm"
                onClick={() => setRubric(r => ({ criteria: [...r.criteria, { name: 'Parameter Baru', max_score: 10, description: '' }] }))}>
                + Tambah Parameter
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ex-tbl-toolbar">
        <div className="ex-tbl-filter">
          <label>Kelas</label>
          <select className="ll-select" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="">Semua Kelas</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="ex-tbl-filter">
          <label>Status</label>
          <select className="ll-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Semua</option>
            <option value="submitted">Sudah Submit</option>
            <option value="missing">Belum Submit</option>
          </select>
        </div>
        <button className="btn-sm btn-sm-primary ex-tbl-batch-btn" onClick={assessAllAI} disabled={batchBusy}>
          {batchBusy ? `⏳ Menilai (${batchProgress.done}/${batchProgress.total})…` : '🤖 Nilai Semua dengan AI'}
        </button>
      </div>

      {(loading || filesLoading) ? (
        <div className="empty-state" style={{ paddingTop: 20 }}><p>Memuat data…</p></div>
      ) : (
        <div className="um-table-wrap">
          <table className="ex-tbl">
            <thead>
              <tr>
                <th>Nama</th>
                <th>NPM</th>
                {rubric.criteria.map((c, i) => (
                  <th key={i}>{c.name} <span className="ex-tbl-max">/{c.max_score}</span></th>
                ))}
                <th>Nilai Final</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(s => {
                const total = computeTotal(s.id)
                const isOpen = expandedId === s.id
                const submitted = hasSubmission(s.id)
                return (
                  <Fragment key={s.id}>
                    <tr
                      className={`ex-tbl-row${isOpen ? ' expanded' : ''}`}
                      onClick={() => setExpandedId(isOpen ? null : s.id)}
                    >
                      <td className="ex-tbl-name-cell">
                        <span className="ex-tbl-chevron">{isOpen ? '▾' : '▸'}</span>
                        {s.name}
                        {!submitted && <span className="ex-tbl-missing-dot" title="Belum submit" />}
                      </td>
                      <td className="ex-tbl-npm">{s.npm}</td>
                      {rubric.criteria.map((c, i) => (
                        <td key={i} onClick={e => e.stopPropagation()}>
                          <input
                            type="number" min="0" max={c.max_score} step="0.5"
                            className="ex-tbl-cell-input"
                            value={cellValue(s.id, i)}
                            onChange={e => handleCellChange(s.id, i, e.target.value)}
                            onBlur={() => commitRow(s.id)}
                          />
                        </td>
                      ))}
                      <td className="ex-tbl-final">
                        {total != null ? <span className="gr-grade-chip">{total}</span> : <span className="ex-tbl-ungraded">—</span>}
                      </td>
                      <td className="ex-tbl-actions" onClick={e => e.stopPropagation()}>
                        <button className="btn-sm" title="Nilai dengan AI" onClick={() => runRowAI(s.id)} disabled={aiRowBusy === s.id}>
                          {aiRowBusy === s.id ? '⏳' : '🤖'}
                        </button>
                        {savingRow === s.id && <span className="ex-tbl-saving">💾</span>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="ex-tbl-expand-row">
                        <td colSpan={totalCols}>
                          <div className="ex-tbl-expand-body">
                            <div className="ex-tbl-expand-col">
                              <div className="ex-tbl-expand-label">📎 Submission Mahasiswa</div>
                              <SubmissionPreview
                                files={filesByUser[s.id]}
                                isSection2={isSection2}
                                sheetRow={isSection2 ? SHEET_ROWS.find(r => r.npm === s.npm) : null}
                              />
                            </div>
                            <div className="ex-tbl-expand-col">
                              <div className="ex-tbl-expand-label">📝 Catatan / Umpan Balik</div>
                              <textarea className="input" rows={2}
                                value={displayNotes(s.id)}
                                onChange={e => setNotesEdits(prev => ({ ...prev, [s.id]: e.target.value }))}
                                onBlur={() => commitRow(s.id)}
                                placeholder="Komentar untuk mahasiswa (opsional)…" />

                              <div className="ex-tbl-expand-label" style={{ marginTop: 12 }}>🤖 Konteks untuk Penilaian AI</div>
                              <textarea className="input ex-ai-context" rows={3}
                                value={aiContextEdits[s.id] ?? ''}
                                onChange={e => setAiContextEdits(prev => ({ ...prev, [s.id]: e.target.value }))}
                                placeholder={buildAutoContext(filesByUser[s.id], isSection2 ? SHEET_ROWS.find(r => r.npm === s.npm) : null)
                                  || 'Tulis deskripsi submission (opsional, kosongkan untuk memakai nama file otomatis)…'} />
                              <button className="btn-sm btn-sm-primary" style={{ marginTop: 8 }}
                                onClick={() => runRowAI(s.id)} disabled={aiRowBusy === s.id}>
                                {aiRowBusy === s.id ? '⏳ Menilai…' : '▶ Nilai dengan AI'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {filteredStudents.length === 0 && (
                <tr><td colSpan={totalCols} className="qv-empty-cell">Tidak ada mahasiswa yang sesuai filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Admin: quiz section ───────────────────────────────────────
function AdminQuizSection({ sectionId, students, onOpenSession }) {
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [openingFor, setOpeningFor]   = useState(null)

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
            <span className="quiz-deploy-meta">{Math.round(dep.time_limit / 60)} mnt</span>
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

  const sectionTitle = SECTIONS.find(s => s.id === sectionId)?.title ?? `Sesi ${sectionId}`

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
        {isSection2 ? (
          <AdminSheetExercise students={students} selectedStudentId={selectedStudentId} />
        ) : (
          <AdminExerciseView sectionId={sectionId} selectedStudentId={selectedStudentId} students={students} />
        )}
        <AdminGradingTable
          sectionId={sectionId}
          sectionTitle={sectionTitle}
          students={students}
          selectedStudentId={selectedStudentId}
          isSection2={isSection2}
        />
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
