import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const functionName = 'cisa-case-submission'
const prettyStatus = {
  pending: 'Menunggu penilaian dosen',
  graded: 'Sudah dinilai',
  grading_failed: 'Penilaian perlu dicoba ulang',
}

export async function getCisaFunctionErrorMessage(error, data) {
  let detail = data?.error
  if (!detail && error?.context) {
    try {
      const responseBody = await error.context.json()
      detail = responseBody?.error || responseBody?.message
    } catch (_) {
      // Keep the SDK message when the response is not JSON.
    }
  }
  return detail || error?.message || 'Edge Function tidak dapat memproses permintaan.'
}

export function isCodexReviewed(row) {
  return row?.assessment?.reviewer_status === 'reviewed_by_codex'
}

export function buildStudentGradeRows(students = [], submissions = [], className = '') {
  const latestByNpm = new Map()
  submissions.filter(row => row.is_latest && (!className || row.class_name === className)).forEach(row => {
    row.members?.forEach(member => latestByNpm.set(String(member.npm), row))
  })
  return students
    .filter(student => !className || student.class === className)
    .map(student => ({ student, submission: latestByNpm.get(String(student.npm)) || null }))
    .sort((a, b) => String(a.student.name || '').localeCompare(String(b.student.name || ''), 'id'))
}

async function invokeCisaFunction(body) {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (!error && !data?.error) return data
  throw new Error(await getCisaFunctionErrorMessage(error, data))
}

function TeamNames({ members = [] }) {
  return <span className="cisa-team-members">
    {members.map(member => <span className="cisa-team-member" key={member.id || member.npm}>
      <span>{member.name} ({member.npm})</span>
      <small>✓ Submit via tim</small>
    </span>)}
  </span>
}

function Assessment({ row, showAnswers = false }) {
  return <div className="cisa-detail">
    {row.assessment?.summary && <div className="cisa-review-summary"><b>Ringkasan penilaian</b><p>{row.assessment.summary}</p>{row.assessment.reviewer && <small>Direviu oleh {row.assessment.reviewer}</small>}</div>}
    {row.assessment?.cases?.map(item => <div className="cisa-case-result" key={item.case_id}>
      <h4>{item.title || item.case_id} · {item.total}/{item.max_score}</h4>
      {item.scores?.map(score => <p key={score.id}><b>{score.id}: {score.score}/{score.max_score}</b> — {score.feedback}</p>)}
    </div>)}
    {!row.assessment && <p>{prettyStatus[row.status] || row.status}.</p>}
    {showAnswers && <><h4>Jawaban yang dikumpulkan</h4>{Object.entries(row.answers || {}).map(([id, answer]) => <div key={id}><b>{id}</b><p>{answer || '—'}</p></div>)}</>}
    {row.grading_error && <p className="cisa-error">Kesalahan AI: {row.grading_error}</p>}
  </div>
}

export default function CisaCaseSubmissions({ profile, students = [] }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [classFilter, setClassFilter] = useState(profile.is_admin ? 'Audit-2' : '')
  const [loading, setLoading] = useState(false)
  const [gradingProgress, setGradingProgress] = useState(null)

  async function refresh() {
    setLoading(true)
    try {
      const data = await invokeCisaFunction({ action: 'list', class_name: profile.is_admin ? classFilter : undefined })
      setSubmissions(data?.submissions || [])
    } catch (error) {
      setMessage(`Gagal memuat submission: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [profile.is_admin, classFilter])

  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.cisaenc') || file.size > 1_000_000) {
      setMessage('Pilih file .cisaenc hasil ekspor (maksimal 1 MB).')
      return
    }
    setBusy(true); setMessage('Memeriksa identitas tim dan jawaban…')
    try {
      const envelope = JSON.parse(await file.text())
      if (envelope?.format !== 'cisa-d4d5-encrypted/v1') throw Error('Format file tidak sesuai.')
      const data = await invokeCisaFunction({ action: 'submit', envelope })
      setMessage(`Jawaban diterima untuk ${data.members.map(member => member.name).join(', ')}. Seluruh anggota tim sekarang dapat melihat submission ini.`)
      setFile(null)
      form.reset()
      await refresh()
    } catch (error) {
      setMessage(`Upload gagal: ${error.message}`)
    } finally { setBusy(false) }
  }

  async function gradeOne(id, refreshAfter = true) {
    const data = await invokeCisaFunction({ action: 'grade', id })
    if (data?.status !== 'graded') throw Error('Penilaian gagal.')
    if (refreshAfter) await refresh()
  }

  async function retryGrade(id) {
    setBusy(true); setMessage('Menilai submission…')
    try {
      await gradeOne(id)
      setMessage('Penilaian AI selesai dan dapat dilihat seluruh anggota tim.')
    } catch (error) { setMessage(`Penilaian gagal: ${error.message}`) }
    finally { setBusy(false) }
  }

  const batchRows = useMemo(() => submissions.filter(row => row.is_latest && row.class_name === classFilter && row.status !== 'graded'), [submissions, classFilter])
  const studentGradeRows = useMemo(() => buildStudentGradeRows(students, submissions, classFilter), [students, submissions, classFilter])

  async function gradeClass() {
    if (!classFilter || !batchRows.length) return
    setBusy(true); setMessage('')
    let completed = 0
    const failures = []
    setGradingProgress({ completed, total: batchRows.length })
    for (const row of batchRows) {
      try { await gradeOne(row.id, false) }
      catch (error) { failures.push(`${row.members?.map(member => member.name).join(', ')}: ${error.message}`) }
      completed += 1
      setGradingProgress({ completed, total: batchRows.length })
    }
    await refresh()
    setBusy(false); setGradingProgress(null)
    setMessage(failures.length ? `${completed - failures.length} berhasil, ${failures.length} gagal. ${failures.join(' | ')}` : `${completed} submission terbaru kelas ${classFilter} selesai dinilai.`)
  }

  return <div className="cisa-page">
    <section className="cisa-card">
      <h3>Upload kertas kerja</h3>
      <p>Cukup satu anggota tim yang mengunggah file. Setelah diterima, submission muncul otomatis pada akun seluruh anggota yang tercantum di kertas kerja.</p>
      <form onSubmit={submit} className="cisa-upload-form">
        <input type="file" accept=".cisaenc" onChange={event => setFile(event.target.files?.[0] || null)} aria-label="Pilih file jawaban terenkripsi" />
        <button className="btn btn-primary" disabled={!file || busy}>{busy ? 'Memproses…' : 'Upload jawaban'}</button>
      </form>
      {message && <p className="cisa-message" role="status">{message}</p>}
    </section>

    {!profile.is_admin && <section className="cisa-card">
      <div className="cisa-card-head"><div><h3>Submission tim saya</h3><p>Yang ditampilkan adalah submission terbaru untuk setiap paket yang mencantumkan Anda sebagai anggota.</p></div><button className="btn" onClick={refresh} disabled={loading}>Refresh</button></div>
      {loading ? <p>Memuat…</p> : !submissions.length ? <div className="cisa-empty"><b>Belum ada submission tim.</b><p>Submission juga akan muncul jika diunggah oleh anggota tim Anda.</p></div> : <div className="cisa-student-results">{submissions.map(row => <article className="cisa-result-card" key={row.id}>
        <div className="cisa-result-head"><div><span className="cisa-package">Paket {row.round}</span><h4><TeamNames members={row.members} /></h4><small>Diunggah {new Date(row.uploaded_at).toLocaleString('id-ID')}</small></div><div className={`cisa-status ${row.status}`}>{prettyStatus[row.status] || row.status}</div></div>
        {row.assessment ? <details><summary>Lihat nilai dan feedback · {row.assessment.total}/{row.assessment.max_score}</summary><Assessment row={row} /></details> : <p className="cisa-waiting">Nilai dan feedback akan muncul di sini setelah dosen menjalankan penilaian.</p>}
      </article>)}</div>}
    </section>}

    {profile.is_admin && <section className="cisa-card">
      <div className="cisa-card-head"><div><h3>Submission dan penilaian kelas</h3><p>Penilaian kelas hanya memproses submission terbaru setiap tim dan paket. Hasil yang sudah direviu Codex ditandai sebagai penilaian final.</p></div><div className="cisa-filters"><select value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="Audit-2">Audit-2</option><option value="Audit-BL">Audit-BL</option><option value="">Semua kelas</option></select><button className="btn" onClick={refresh} disabled={loading || busy}>Refresh</button><button className="btn btn-primary" onClick={gradeClass} disabled={busy || !classFilter || !batchRows.length}>Nilai kelas ({batchRows.length})</button></div></div>
      {gradingProgress && <div className="cisa-progress" role="status"><div style={{ width: `${gradingProgress.total ? gradingProgress.completed / gradingProgress.total * 100 : 0}%` }} /><span>Menilai {gradingProgress.completed}/{gradingProgress.total} submission</span></div>}
      {loading ? <p>Memuat…</p> : !studentGradeRows.length ? <p>Tidak ada mahasiswa pada kelas ini.</p> : <div className="cisa-table-wrap"><table className="cisa-table"><thead><tr><th>NPM</th><th>Mahasiswa</th><th>Tim</th><th>Paket</th><th>Submission terakhir</th><th>Status</th><th>Nilai</th><th>Detail</th></tr></thead><tbody>{studentGradeRows.map(({ student, submission: row }) => {
        const teammates = row?.members?.filter(member => String(member.npm) !== String(student.npm)) || []
        return <tr key={student.id || student.npm}>
          <td>{student.npm}</td><td>{student.name}</td><td>{teammates.length ? teammates.map(member => member.name).join(', ') : '—'}</td><td>{row?.round || '—'}</td><td>{row ? new Date(row.uploaded_at).toLocaleString('id-ID') : '—'}</td><td>{row ? (prettyStatus[row.status] || row.status) : 'Belum mengumpulkan'}</td><td>{row?.assessment ? `${row.assessment.total} / ${row.assessment.max_score}` : '—'}</td>
          <td>{row ? <details><summary>Lihat</summary><Assessment row={row} showAnswers />{isCodexReviewed(row) ? <span className="cisa-final-grade">Penilaian final Codex</span> : <button className="btn" disabled={busy} onClick={() => retryGrade(row.id)}>{row.status === 'graded' ? 'Nilai lagi dengan AI' : 'Nilai dengan AI'}</button>}</details> : '—'}</td>
        </tr>
      })}</tbody></table></div>}
    </section>}
  </div>
}
