import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const functionName = 'cisa-case-submission'
const prettyStatus = {
  pending: 'Menunggu penilaian',
  graded: 'Dinilai AI · perlu tinjauan dosen',
  grading_failed: 'Penilaian AI perlu dicoba ulang',
}

export default function CisaCaseSubmissions({ profile }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [classFilter, setClassFilter] = useState('')
  const [loading, setLoading] = useState(false)

  async function refresh() {
    if (!profile.is_admin) return
    setLoading(true)
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { action: 'list', class_name: classFilter },
    })
    setLoading(false)
    if (error || data?.error) { setMessage(error?.message || data?.error); return }
    setSubmissions(data?.submissions || [])
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
    setBusy(true); setMessage('Memeriksa tim dan jawaban; penilaian AI mungkin memerlukan beberapa saat…')
    try {
      const envelope = JSON.parse(await file.text())
      if (envelope?.format !== 'cisa-d4d5-encrypted/v1') throw Error('Format file tidak sesuai.')
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { action: 'submit', envelope },
      })
      if (error || data?.error) throw Error(data?.error || error.message)
      setMessage(`Jawaban diterima untuk ${data.members.map(member => member.name).join(', ')}. ${prettyStatus[data.status] || data.status}.`)
      setFile(null)
      form.reset()
      if (profile.is_admin) await refresh()
    } catch (error) {
      setMessage(`Upload gagal: ${error.message}`)
    } finally { setBusy(false) }
  }

  async function retryGrade(id) {
    setBusy(true); setMessage('Menilai ulang…')
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { action: 'grade', id },
    })
    setBusy(false)
    setMessage(error?.message || data?.error || prettyStatus[data?.status] || 'Selesai.')
    await refresh()
  }

  return <div className="cisa-page">
    <section className="cisa-card">
      <h3>Upload kertas kerja</h3>
      <p>Kerjakan HTML offline yang diberikan dosen. Ekspor file terenkripsi dari paket soal yang dibuka, lalu unggah di sini memakai akun salah satu anggota tim. Anggota tim dan kelas diperiksa ulang saat upload.</p>
      <form onSubmit={submit} className="cisa-upload-form">
        <input type="file" accept=".cisaenc" onChange={event => setFile(event.target.files?.[0] || null)} aria-label="Pilih file jawaban terenkripsi" />
        <button className="btn btn-primary" disabled={!file || busy}>{busy ? 'Memproses…' : 'Upload jawaban'}</button>
      </form>
      {message && <p className="cisa-message" role="status">{message}</p>}
    </section>

    {profile.is_admin && <section className="cisa-card">
      <div className="cisa-card-head"><div><h3>Submission dan penilaian</h3><p>Skor AI adalah draf, bukan nilai final. Setiap unggahan disimpan sebagai versi tersendiri.</p></div><div className="cisa-filters"><select value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="">Semua kelas</option><option value="Audit-2">Audit-2</option><option value="Audit-BL">Audit-BL</option></select><button className="btn" onClick={refresh} disabled={loading}>Refresh</button></div></div>
      {loading ? <p>Memuat…</p> : !submissions.length ? <p>Belum ada submission.</p> : <div className="cisa-table-wrap"><table className="cisa-table"><thead><tr><th>Kelas</th><th>Ronde</th><th>Tim</th><th>Upload</th><th>Status</th><th>Skor AI</th><th>Detail</th></tr></thead><tbody>{submissions.map(row => <tr key={row.id}>
        <td>{row.class_name}</td><td>{row.round}</td><td>{(row.members || []).map(member => `${member.name} (${member.npm})`).join(', ')}</td><td>{new Date(row.uploaded_at).toLocaleString('id-ID')}</td><td>{prettyStatus[row.status] || row.status}</td><td>{row.assessment ? `${row.assessment.total} / ${row.assessment.max_score}` : '—'}</td>
        <td><details><summary>Lihat</summary><div className="cisa-detail">{row.assessment?.cases?.map(item => <div key={item.case_id}><h4>{item.case_id} · {item.total}/{item.max_score}</h4>{item.scores?.map(score => <p key={score.id}><b>{score.id}: {score.score}/{score.max_score}</b> — {score.feedback}</p>)}</div>)}<h4>Jawaban</h4>{Object.entries(row.answers || {}).map(([id, answer]) => <div key={id}><b>{id}</b><p>{answer || '—'}</p></div>)}{row.grading_error && <p>Kesalahan AI: {row.grading_error}</p>}<button className="btn" disabled={busy} onClick={() => retryGrade(row.id)}>{row.status === 'graded' ? 'Nilai lagi dengan AI' : 'Coba nilai dengan AI'}</button></div></details></td>
      </tr>)}</tbody></table></div>}
    </section>}
  </div>
}
