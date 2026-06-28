import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// ── Countdown hook ────────────────────────────────────────────
function useCountdown(endAt) {
  const [remaining, setRemaining] = useState(null)
  useEffect(() => {
    if (!endAt) { setRemaining(null); return }
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(endAt).getTime() - Date.now()) / 1000))
      setRemaining(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endAt])
  return remaining
}

function fmtCountdown(sec) {
  if (sec === null) return ''
  if (sec <= 0) return '00:00:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ── Stars remaining ───────────────────────────────────────────
function StarsRemaining({ count }) {
  return (
    <div className="vb-stars-remaining">
      <span className="vb-stars-label">Star tersisa:</span>
      {[0,1,2].map(i => (
        <span key={i} className={`vb-star-icon${i < count ? ' active' : ''}`}>★</span>
      ))}
      <span className="vb-stars-count">{count}</span>
    </div>
  )
}

// ── Sandboxed iframe prototype frame ─────────────────────────
function PrototypeFrame({ htmlUrl, title }) {
  const [srcdoc, setSrcdoc]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const [fullscreen, setFs]     = useState(false)
  const wrapRef                 = useRef()

  // Fetch HTML as text → use srcdoc to bypass storage content-type/disposition headers
  useEffect(() => {
    if (!htmlUrl) { setSrcdoc(null); return }
    setLoading(true)
    fetch(htmlUrl)
      .then(r => r.text())
      .then(text => { setSrcdoc(text); setLoading(false) })
      .catch(() => { setSrcdoc(null); setLoading(false) })
  }, [htmlUrl, fetchKey])

  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  function toggleFs() {
    if (!document.fullscreenElement) wrapRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  return (
    <div ref={wrapRef} className={`vb-frame-wrap${fullscreen ? ' vb-frame-fs' : ''}`}>
      <div className="vb-frame-toolbar">
        <span className="vb-frame-title">{title}</span>
        {loading && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Memuat…</span>}
        <button className="btn-sm" onClick={() => setFetchKey(k => k + 1)} title="Refresh">🔄</button>
        <button className="btn-sm vb-fs-btn" onClick={toggleFs} title={fullscreen ? 'Keluar fullscreen' : 'Fullscreen'}>
          {fullscreen ? '⊡' : '⊞'}
        </button>
      </div>
      {srcdoc !== null
        ? <iframe
            key={fetchKey}
            srcdoc={srcdoc}
            title={title || 'Preview'}
            className="vb-iframe"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
          />
        : <div className="vb-frame-empty">
            <div className="vb-frame-empty-icon">{loading ? '⏳' : htmlUrl ? '⚠️' : '🖥️'}</div>
            <p>{loading ? 'Memuat preview…' : htmlUrl ? 'Gagal memuat preview.' : 'Belum ada file HTML.'}</p>
          </div>
      }
    </div>
  )
}

// ── Admin toggle control ──────────────────────────────────────
function AdminToggle({ on, onChange, labelOn, labelOff, disabled }) {
  return (
    <button
      className={`vb-toggle${on ? ' on' : ''}${disabled ? ' disabled' : ''}`}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
    >
      <span className="vb-toggle-dot" />
      <span className="vb-toggle-label">{on ? labelOn : labelOff}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// ADMIN VIEW
// ─────────────────────────────────────────────────────────────
function VibersAdminView() {
  const [iterations, setIterations] = useState([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [newTitle, setNewTitle]     = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [saving, setSaving]         = useState({})
  const [expandSubs, setExpandSubs] = useState({})  // iterationId → subs[]
  const [editTimer, setEditTimer]   = useState({})  // iterationId → { start, end }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('admin_get_vibers_iterations')
    setIterations(data ?? [])
    setLoading(false)
  }

  async function createIteration() {
    if (!newTitle.trim()) return
    setSaving(s => ({ ...s, new: true }))
    await supabase.rpc('admin_create_vibers_iteration', { p_title: newTitle.trim(), p_description: newDesc.trim() })
    setNewTitle(''); setNewDesc(''); setCreating(false)
    setSaving(s => ({ ...s, new: false }))
    load()
  }

  async function toggleField(iter, field) {
    const updated = { ...iter, [field]: !iter[field] }
    setIterations(prev => prev.map(i => i.id === iter.id ? updated : i))
    await supabase.rpc('admin_update_vibers_iteration', {
      p_id: iter.id, p_title: updated.title, p_description: updated.description,
      p_is_visible: updated.is_visible, p_submission_open: updated.submission_open,
      p_gallery_open: updated.gallery_open, p_voting_open: updated.voting_open,
      p_leaderboard_open: updated.leaderboard_open,
      p_voting_start: updated.voting_start || null,
      p_voting_end: updated.voting_end || null,
    })
    load()
  }

  async function saveTimer(iter) {
    const t = editTimer[iter.id] ?? {}
    setSaving(s => ({ ...s, [iter.id]: true }))
    await supabase.rpc('admin_update_vibers_iteration', {
      p_id: iter.id, p_title: iter.title, p_description: iter.description,
      p_is_visible: iter.is_visible, p_submission_open: iter.submission_open,
      p_gallery_open: iter.gallery_open, p_voting_open: iter.voting_open,
      p_leaderboard_open: iter.leaderboard_open,
      p_voting_start: t.start || null,
      p_voting_end: t.end || null,
    })
    setSaving(s => ({ ...s, [iter.id]: false }))
    setEditTimer(prev => { const n = { ...prev }; delete n[iter.id]; return n })
    load()
  }

  async function deleteIter(id) {
    if (!confirm('Hapus iterasi ini? Semua submission dan vote akan terhapus.')) return
    await supabase.rpc('admin_delete_vibers_iteration', { p_id: id })
    load()
  }

  async function resetVotes(id) {
    if (!confirm('Reset semua vote untuk iterasi ini?')) return
    await supabase.rpc('admin_reset_vibers_votes', { p_iteration_id: id })
    load()
  }

  async function loadSubs(id) {
    if (expandSubs[id]) { setExpandSubs(p => { const n = {...p}; delete n[id]; return n }); return }
    const { data } = await supabase.rpc('admin_get_vibers_submissions', { p_iteration_id: id })
    setExpandSubs(p => ({ ...p, [id]: data ?? [] }))
  }

  if (loading) return <div className="empty-state"><p>Memuat…</p></div>

  return (
    <div className="vb-admin-wrap">
      <div className="vb-admin-header">
        <h3 className="vb-admin-title">Kelola Iterasi Vibers</h3>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Iterasi Baru</button>
      </div>

      {creating && (
        <div className="vb-new-iter-form">
          <input className="input" placeholder="Judul iterasi…" value={newTitle}
            onChange={e => setNewTitle(e.target.value)} autoFocus />
          <textarea className="input vb-new-iter-desc" placeholder="Deskripsi (opsional)…"
            value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
          <div className="vb-new-iter-btns">
            <button className="btn" onClick={() => setCreating(false)}>Batal</button>
            <button className="btn btn-primary" onClick={createIteration}
              disabled={saving.new || !newTitle.trim()}>
              {saving.new ? 'Membuat…' : 'Buat Iterasi'}
            </button>
          </div>
        </div>
      )}

      {iterations.length === 0 && !creating && (
        <div className="empty-state">
          <div className="icon">🚀</div>
          <p>Belum ada iterasi. Buat iterasi pertama untuk memulai.</p>
        </div>
      )}

      <div className="vb-iter-list">
        {iterations.map(iter => {
          const t = editTimer[iter.id]
          const subsOpen = !!expandSubs[iter.id]
          return (
            <div key={iter.id} className={`vb-iter-card${iter.is_visible ? ' visible' : ''}`}>
              <div className="vb-iter-card-top">
                <div className="vb-iter-info">
                  <div className="vb-iter-title">{iter.title}</div>
                  {iter.description && <div className="vb-iter-desc">{iter.description}</div>}
                  <div className="vb-iter-meta">
                    {iter.submission_count} submission · {iter.vote_count} vote
                    <span className="vb-iter-date"> · {new Date(iter.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
                <div className="vb-iter-actions">
                  <button className="btn-sm" onClick={() => loadSubs(iter.id)}>
                    {subsOpen ? '▲ Tutup' : '📋 Lihat Submission'}
                  </button>
                  <button className="btn-sm" onClick={() => resetVotes(iter.id)}>↺ Reset Vote</button>
                  <button className="btn-sm btn-danger-icon" onClick={() => deleteIter(iter.id)}>🗑</button>
                </div>
              </div>

              <div className="vb-iter-toggles">
                <AdminToggle on={iter.is_visible} onChange={() => toggleField(iter, 'is_visible')}
                  labelOn="✅ Dipublikasikan" labelOff="🔒 Tersembunyi" />
                <AdminToggle on={iter.submission_open} onChange={() => toggleField(iter, 'submission_open')}
                  labelOn="📝 Submission Buka" labelOff="🔐 Submission Tutup" />
                <AdminToggle on={iter.gallery_open} onChange={() => toggleField(iter, 'gallery_open')}
                  labelOn="🖼️ Galeri Buka" labelOff="🔐 Galeri Tutup" />
                <AdminToggle on={iter.voting_open} onChange={() => toggleField(iter, 'voting_open')}
                  labelOn="⭐ Voting Buka" labelOff="🔐 Voting Tutup" />
                <AdminToggle on={iter.leaderboard_open} onChange={() => toggleField(iter, 'leaderboard_open')}
                  labelOn="🏆 Leaderboard Buka" labelOff="🔐 Leaderboard Tutup" />
              </div>

              {/* Voting timer */}
              <div className="vb-timer-row">
                <span className="vb-timer-label">Timer voting:</span>
                <input type="datetime-local" className="vb-timer-input"
                  defaultValue={iter.voting_start ? iter.voting_start.slice(0,16) : ''}
                  onChange={e => setEditTimer(p => ({ ...p, [iter.id]: { ...(p[iter.id]||{}), start: e.target.value } }))}
                  placeholder="Mulai" />
                <span className="vb-timer-sep">→</span>
                <input type="datetime-local" className="vb-timer-input"
                  defaultValue={iter.voting_end ? iter.voting_end.slice(0,16) : ''}
                  onChange={e => setEditTimer(p => ({ ...p, [iter.id]: { ...(p[iter.id]||{}), end: e.target.value } }))}
                  placeholder="Selesai" />
                {t && (
                  <button className="btn-sm btn-sm-primary" onClick={() => saveTimer(iter)}
                    disabled={saving[iter.id]}>
                    {saving[iter.id] ? '…' : '💾'}
                  </button>
                )}
                {(iter.voting_start || iter.voting_end) && !t && (
                  <span className="vb-timer-set">✓ Timer aktif</span>
                )}
              </div>

              {/* Submissions list */}
              {subsOpen && (
                <div className="vb-subs-list">
                  <div className="vb-subs-header">Submission ({(expandSubs[iter.id] ?? []).length})</div>
                  {(expandSubs[iter.id] ?? []).length === 0
                    ? <div className="vb-subs-empty">Belum ada submission.</div>
                    : (
                      <table className="vb-subs-table">
                        <thead><tr><th>Nama</th><th>Kelas</th><th>Judul Proyek</th><th>⭐</th><th>Waktu</th></tr></thead>
                        <tbody>
                          {expandSubs[iter.id].map(s => (
                            <tr key={s.id}>
                              <td>{s.student_name}</td>
                              <td>{s.student_class}</td>
                              <td>{s.project_title}</td>
                              <td>{s.vote_count}</td>
                              <td>{new Date(s.submitted_at).toLocaleString('id-ID', { dateStyle:'short', timeStyle:'short' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// STUDENT VIEW
// ─────────────────────────────────────────────────────────────

// ── Submission form ───────────────────────────────────────────
function SubmissionPanel({ iterationId, submissionOpen, mySubmission, onRefresh }) {
  const [form, setForm]       = useState({ title: '', desc: '' })
  const [htmlFile, setHtml]   = useState(null)
  const [thumbFile, setThumb] = useState(null)
  const [uploading, setUpl]   = useState(false)
  const [deleting, setDel]    = useState(false)
  const [err, setErr]         = useState('')
  const htmlRef               = useRef()
  const thumbRef              = useRef()
  const [editing, setEditing] = useState(!mySubmission)

  useEffect(() => {
    if (mySubmission) {
      setForm({ title: mySubmission.project_title, desc: mySubmission.description ?? '' })
      setEditing(false)
    } else {
      setForm({ title: '', desc: '' })
      setEditing(true)
    }
  }, [mySubmission?.id])

  function pickHtml(e) {
    const f = e.target.files[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.html') && f.type !== 'text/html') {
      setErr('Hanya file .html yang diizinkan.'); e.target.value = ''; return
    }
    setHtml(f); setErr('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setErr('Judul wajib diisi.'); return }
    if (!mySubmission && !htmlFile) { setErr('File HTML wajib diunggah.'); return }
    setUpl(true); setErr('')

    try {
      let htmlUrl  = mySubmission?.html_url ?? null
      let thumbUrl = mySubmission?.thumbnail_url ?? null

      if (htmlFile) {
        const path = `${iterationId}/html/${Date.now()}.html`
        const { error: upErr } = await supabase.storage.from('vibers-html').upload(path, htmlFile, { upsert: false, contentType: 'text/html' })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('vibers-html').getPublicUrl(path)
        htmlUrl = publicUrl
      }

      if (thumbFile) {
        const ext  = (thumbFile.name.split('.').pop() || 'jpg').toLowerCase()
        const tpath = `${iterationId}/thumb/${Date.now()}.${ext}`
        const { error: tErr } = await supabase.storage.from('vibers-thumb').upload(tpath, thumbFile, { upsert: false })
        if (tErr) throw tErr
        const { data: { publicUrl: tUrl } } = supabase.storage.from('vibers-thumb').getPublicUrl(tpath)
        thumbUrl = tUrl
      }

      const { error } = await supabase.rpc('vibers_upsert_submission', {
        p_iteration_id: iterationId,
        p_project_title: form.title.trim(),
        p_description: form.desc.trim(),
        p_html_url: htmlUrl,
        p_thumbnail_url: thumbUrl,
      })
      if (error) throw error

      setHtml(null); setThumb(null)
      if (htmlRef.current)  htmlRef.current.value  = ''
      if (thumbRef.current) thumbRef.current.value = ''
      setEditing(false)
      onRefresh()
    } catch (ex) {
      setErr(ex.message)
    }
    setUpl(false)
  }

  async function handleDelete() {
    if (!confirm('Hapus submission ini?')) return
    setDel(true)
    await supabase.rpc('vibers_delete_submission', { p_iteration_id: iterationId })
    setDel(false)
    onRefresh()
  }

  const locked = !submissionOpen

  if (locked && !mySubmission) {
    return (
      <div className="vb-locked-state">
        <div className="vb-locked-icon">🔒</div>
        <div className="vb-locked-msg">Submission telah dikunci oleh instruktur.</div>
      </div>
    )
  }

  return (
    <div className="vb-submission-panel">
      {mySubmission && !editing ? (
        <>
          {/* Preview own submission */}
          <div className="vb-my-sub-header">
            <div>
              <div className="vb-my-sub-title">{mySubmission.project_title}</div>
              {mySubmission.description && <div className="vb-my-sub-desc">{mySubmission.description}</div>}
            </div>
            {!locked && (
              <div className="vb-my-sub-btns">
                <button className="btn-sm btn-sm-primary" onClick={() => setEditing(true)}>✏️ Edit</button>
                <button className="btn-sm btn-danger-icon" onClick={handleDelete} disabled={deleting}>
                  {deleting ? '…' : '🗑 Hapus'}
                </button>
              </div>
            )}
          </div>
          {locked && (
            <div className="vb-locked-banner">🔒 Submission telah dikunci oleh instruktur. Tidak dapat diubah.</div>
          )}
          {mySubmission.html_url && (
            <PrototypeFrame htmlUrl={mySubmission.html_url} title={mySubmission.project_title} />
          )}
        </>
      ) : (
        <form className="vb-submit-form" onSubmit={handleSubmit}>
          <div className="vb-form-group">
            <label className="vb-form-label">Judul Proyek *</label>
            <input className="input" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Nama proyek Anda…" required />
          </div>
          <div className="vb-form-group">
            <label className="vb-form-label">Deskripsi Singkat</label>
            <textarea className="input" rows={3} value={form.desc}
              onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
              placeholder="Jelaskan proyek Anda dalam 1–2 kalimat…" />
          </div>
          <div className="vb-form-group">
            <label className="vb-form-label">
              File HTML {!mySubmission && '*'}
              {mySubmission && <span className="vb-form-hint"> — kosongkan jika tidak diganti</span>}
            </label>
            <div className="vb-file-upload-row">
              <button type="button" className="btn-sm" onClick={() => htmlRef.current.click()}>
                📄 Pilih .html
              </button>
              {htmlFile && <span className="vb-file-name">{htmlFile.name}</span>}
              {!htmlFile && mySubmission?.html_url && <span className="vb-file-exists">✓ File sudah ada</span>}
            </div>
            <input ref={htmlRef} type="file" accept=".html,text/html" style={{ display: 'none' }}
              onChange={pickHtml} />
            <div className="vb-file-hint">
              Hanya file <strong>.html</strong> — CSS & JS harus disertakan di dalam file (inline/embedded).
            </div>
          </div>
          <div className="vb-form-group">
            <label className="vb-form-label">Thumbnail (opsional)</label>
            <div className="vb-file-upload-row">
              <button type="button" className="btn-sm" onClick={() => thumbRef.current.click()}>
                🖼️ Pilih gambar
              </button>
              {thumbFile && <span className="vb-file-name">{thumbFile.name}</span>}
              {!thumbFile && mySubmission?.thumbnail_url && <span className="vb-file-exists">✓ Thumbnail ada</span>}
            </div>
            <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => setThumb(e.target.files[0] || null)} />
          </div>
          {err && <div className="qm-err">{err}</div>}
          <div className="vb-form-btns">
            {mySubmission && (
              <button type="button" className="btn" onClick={() => { setEditing(false); setErr('') }}>Batal</button>
            )}
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Mengunggah…' : mySubmission ? '💾 Perbarui Submission' : '🚀 Kirim Proyek'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Gallery: two-panel ─────────────────────────────────────────
function GalleryPanel({ iterationId, votingOpen, votingEnd, myVotes: initVotes, myVotesCount: initCount }) {
  const [subs, setSubs]         = useState(null)
  const [selectedId, setSelected] = useState(null)
  const [myVotes, setMyVotes]   = useState(new Set(initVotes ?? []))
  const [voteCount, setVoteCount] = useState(initCount ?? 0)
  const [voting, setVoting]     = useState(false)

  const countdown = useCountdown(votingEnd)
  const votingExpired = countdown !== null && countdown <= 0
  const canVote = votingOpen && !votingExpired

  useEffect(() => {
    supabase.rpc('get_vibers_gallery', { p_iteration_id: iterationId })
      .then(({ data }) => {
        const list = data ?? []
        setSubs(list)
        if (list.length > 0) setSelected(list[0].submission_id)
      })
  }, [iterationId])

  useEffect(() => {
    setMyVotes(new Set(initVotes ?? []))
    setVoteCount(initCount ?? 0)
  }, [iterationId])

  async function handleVote(submissionId) {
    if (voting) return
    setVoting(true)
    const voted = myVotes.has(submissionId)
    try {
      if (voted) {
        const { error } = await supabase.rpc('vibers_unvote', { p_submission_id: submissionId })
        if (error) throw error
        setMyVotes(prev => { const n = new Set(prev); n.delete(submissionId); return n })
        setVoteCount(c => c - 1)
        setSubs(prev => prev.map(s =>
          s.submission_id === submissionId
            ? { ...s, vote_count: s.vote_count - 1, i_voted: false } : s
        ))
      } else {
        if (voteCount >= 3) { alert('Batas 3 star sudah tercapai.'); setVoting(false); return }
        const { error } = await supabase.rpc('vibers_vote', { p_submission_id: submissionId })
        if (error) throw error
        setMyVotes(prev => new Set([...prev, submissionId]))
        setVoteCount(c => c + 1)
        setSubs(prev => prev.map(s =>
          s.submission_id === submissionId
            ? { ...s, vote_count: s.vote_count + 1, i_voted: true } : s
        ))
      }
    } catch (ex) { alert(ex.message) }
    setVoting(false)
  }

  if (subs === null) return <div className="empty-state"><p>Memuat galeri…</p></div>
  if (subs.length === 0) return (
    <div className="empty-state">
      <div className="icon">🖼️</div>
      <p>Belum ada submission dari kelas Anda.</p>
    </div>
  )

  const selected = subs.find(s => s.submission_id === selectedId)

  return (
    <div className="vb-gallery-wrap">
      {/* Voting status bar */}
      {(votingOpen || votingExpired) && (
        <div className={`vb-voting-bar${votingExpired ? ' expired' : ''}`}>
          {canVote ? (
            <>
              <StarsRemaining count={3 - voteCount} />
              {countdown !== null && countdown > 0 && (
                <span className="vb-voting-timer">Voting berakhir dalam: {fmtCountdown(countdown)}</span>
              )}
            </>
          ) : (
            <span className="vb-voting-closed">⏰ Voting telah berakhir</span>
          )}
        </div>
      )}

      <div className="vb-gallery-body">
        {/* Left panel: student list */}
        <div className="vb-gallery-left">
          <div className="vb-gallery-left-header">Peserta</div>
          {subs.map(s => (
            <div
              key={s.submission_id}
              className={`vb-student-item${s.submission_id === selectedId ? ' selected' : ''}${s.is_me ? ' me' : ''}`}
              onClick={() => setSelected(s.submission_id)}
            >
              <span className="vb-student-name">{s.student_name}</span>
              <span className="vb-student-right">
                {s.is_me && <span className="vb-you-tag">Anda</span>}
                {myVotes.has(s.submission_id)
                  ? <span className="vb-voted-star">★</span>
                  : <span className="vb-unvoted-dot">●</span>
                }
              </span>
            </div>
          ))}
        </div>

        {/* Right panel: project display */}
        <div className="vb-gallery-right">
          {selected ? (
            <>
              <div className="vb-project-header">
                <div className="vb-project-meta">
                  <div className="vb-project-title">{selected.project_title}</div>
                  <div className="vb-project-by">oleh {selected.student_name}</div>
                  {selected.description && (
                    <div className="vb-project-desc">{selected.description}</div>
                  )}
                </div>
                {canVote && !selected.is_me && (
                  <button
                    className={`vb-vote-btn${myVotes.has(selected.submission_id) ? ' voted' : ''}`}
                    onClick={() => handleVote(selected.submission_id)}
                    disabled={voting}
                  >
                    {myVotes.has(selected.submission_id) ? '★ Batalkan' : '☆ Beri Star'}
                  </button>
                )}
                {selected.is_me && <span className="vb-own-tag">Karya Anda</span>}
              </div>
              <PrototypeFrame htmlUrl={selected.html_url} title={selected.project_title} />
            </>
          ) : (
            <div className="empty-state"><p>Pilih peserta di sebelah kiri.</p></div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Leaderboard ───────────────────────────────────────────────
function LeaderboardPanel({ iterationId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    supabase.rpc('get_vibers_leaderboard', { p_iteration_id: iterationId })
      .then(({ data }) => setData(data ?? []))
  }, [iterationId])

  if (data === null) return <div className="empty-state"><p>Memuat leaderboard…</p></div>
  if (data.length === 0) return <div className="empty-state"><p>Belum ada data.</p></div>

  const top3 = data.slice(0, 3)
  const rest = data.slice(3)

  const medals = ['🥇', '🥈', '🥉']
  const podiumOrder = [1, 0, 2] // 2nd, 1st, 3rd for visual podium

  return (
    <div className="vb-leaderboard-wrap">
      {/* Podium */}
      {top3.length >= 1 && (
        <div className="vb-podium">
          {podiumOrder.map(i => {
            const item = top3[i]
            if (!item) return <div key={i} className="vb-podium-slot empty" />
            return (
              <div key={i} className={`vb-podium-slot rank-${i + 1}${item.is_me ? ' me' : ''}`}>
                <div className="vb-podium-medal">{medals[i]}</div>
                {item.thumbnail_url && (
                  <img src={item.thumbnail_url} alt="thumb" className="vb-podium-thumb" />
                )}
                <div className="vb-podium-name">{item.student_name}</div>
                <div className="vb-podium-project">{item.project_title}</div>
                <div className="vb-podium-stars">★ {item.vote_count}</div>
                {item.is_me && <div className="vb-podium-you">Anda</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Full table */}
      <table className="vb-lb-table">
        <thead>
          <tr><th>#</th><th>Nama</th><th>Proyek</th><th>⭐</th></tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.submission_id} className={item.is_me ? 'vb-lb-me' : ''}>
              <td className="vb-lb-rank">{medals[item.rank - 1] ?? `#${item.rank}`}</td>
              <td>
                {item.student_name}
                {item.is_me && <span className="vb-lb-you-tag"> (Anda)</span>}
              </td>
              <td>{item.project_title}</td>
              <td className="vb-lb-stars">★ {item.vote_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Student iteration view ─────────────────────────────────────
function IterationView({ iter, onRefresh }) {
  const phases = []
  if (iter.submission_open || iter.my_submission) phases.push('submit')
  if (iter.gallery_open || iter.voting_open) phases.push('gallery')
  if (iter.leaderboard_open) phases.push('leaderboard')
  // Always show submit if nothing else is open
  if (phases.length === 0) phases.push('submit')

  const [tab, setTab] = useState(phases[phases.length - 1])

  const tabLabels = { submit: '📝 Karya Saya', gallery: '🖼️ Galeri', leaderboard: '🏆 Leaderboard' }

  return (
    <div className="vb-iter-view">
      {iter.description && <div className="vb-iter-view-desc">{iter.description}</div>}

      <div className="tabs">
        {phases.map(p => (
          <button key={p} className={`tab-btn${tab === p ? ' active' : ''}`} onClick={() => setTab(p)}>
            {tabLabels[p]}
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <SubmissionPanel
          iterationId={iter.id}
          submissionOpen={iter.submission_open}
          mySubmission={iter.my_submission}
          onRefresh={onRefresh}
        />
      )}
      {tab === 'gallery' && (
        <GalleryPanel
          key={iter.id}
          iterationId={iter.id}
          votingOpen={iter.voting_open}
          votingEnd={iter.voting_end}
          myVotes={iter.my_votes ?? []}
          myVotesCount={Number(iter.my_votes_count ?? 0)}
        />
      )}
      {tab === 'leaderboard' && (
        <LeaderboardPanel key={iter.id} iterationId={iter.id} />
      )}
    </div>
  )
}

function VibersStudentView({ profile }) {
  const [iterations, setIterations] = useState(null)
  const [activeId, setActiveId]     = useState(null)

  async function load() {
    const { data } = await supabase.rpc('get_my_vibers_iterations')
    const list = data ?? []
    setIterations(list)
    if (list.length > 0 && !activeId) setActiveId(list[list.length - 1].id)
  }

  useEffect(() => { load() }, [])

  if (iterations === null) return <div className="empty-state"><p>Memuat…</p></div>
  if (iterations.length === 0) return (
    <div className="empty-state">
      <div className="icon">🚀</div>
      <p>Belum ada Vibers yang dipublikasikan.<br />Nantikan iterasi pertama dari instruktur!</p>
    </div>
  )

  const active = iterations.find(i => i.id === activeId) ?? iterations[iterations.length - 1]

  return (
    <div className="vb-student-wrap">
      {iterations.length > 1 && (
        <div className="class-tabs vb-iter-tabs">
          {iterations.map((it, idx) => (
            <button key={it.id}
              className={`class-tab${it.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(it.id)}
            >
              Iterasi {idx + 1}
            </button>
          ))}
        </div>
      )}
      <div className="vb-active-iter-title">{active.title}</div>
      <IterationView key={active.id} iter={active} onRefresh={load} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE EXPORT
// ─────────────────────────────────────────────────────────────
export default function VibersPage({ profile }) {
  const isAdmin = profile.is_admin
  const [adminTab, setAdminTab] = useState('manage')

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Vibers</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {isAdmin ? 'Kelola iterasi, submission, dan voting' : 'Showcase produk front-end · Jelajahi · Vote'}
        </p>
      </div>

      {isAdmin && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab-btn${adminTab === 'manage' ? ' active' : ''}`}
            onClick={() => setAdminTab('manage')}>⚙️ Kelola Iterasi</button>
          <button className={`tab-btn${adminTab === 'preview' ? ' active' : ''}`}
            onClick={() => setAdminTab('preview')}>👁️ Preview Mahasiswa</button>
        </div>
      )}

      {isAdmin && adminTab === 'manage' && <VibersAdminView />}
      {(!isAdmin || adminTab === 'preview') && <VibersStudentView profile={profile} />}
    </div>
  )
}
