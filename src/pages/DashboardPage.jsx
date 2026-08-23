import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { SECTIONS } from '../sections'

export default function DashboardPage({ profile, starsMap = {}, onNavigate, onManageDeadlines }) {
  const [assignments, setAssignments] = useState([])
  const [noteCount, setNoteCount]     = useState(0)
  const [utsGrade, setUtsGrade]       = useState(null)
  const [utsOpen, setUtsOpen]         = useState(false)
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: n }, { data: g }] = await Promise.all([
        supabase.rpc('get_assignments'),
        supabase.rpc('get_my_note_count'),
        ...(profile.is_admin ? [Promise.resolve({ data: null })] : [supabase.rpc('get_my_uts_grade')]),
      ])
      setAssignments(a ?? [])
      setNoteCount(n ?? 0)
      setUtsGrade(g)
      setLoading(false)
    }
    load()
  }, [])

  function urgency(dateStr) {
    const days = (new Date(dateStr) - Date.now()) / 86_400_000
    if (days < 0)  return 'overdue'
    if (days <= 2) return 'urgent'
    if (days <= 7) return 'soon'
    return ''
  }

  function fmtDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const totalStars = Object.values(starsMap).reduce((a, b) => a + b, 0)
  const starredSessions = Object.keys(starsMap).length

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Selamat datang, {profile.name ?? profile.npm}</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Jurnal Ditulis</div>
          <div className="stat-value">{noteCount}</div>
          <div className="stat-sub">dari 16 sesi</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sesi</div>
          <div className="stat-value">16</div>
          <div className="stat-sub">Pre-UTS + Post-UTS</div>
        </div>
        {!profile.is_admin ? (
          <div className="stat-card">
            <div className="stat-label">Total Bintang ★</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{totalStars}</div>
            <div className="stat-sub">dari {starredSessions} sesi</div>
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-label">Deadline Aktif</div>
            <div className="stat-value">{assignments.length}</div>
            <div className="stat-sub">tugas mendatang</div>
          </div>
        )}
        {!profile.is_admin && (
          <button
            type="button"
            className={`stat-card stat-card-button${utsOpen ? ' is-open' : ''}`}
            onClick={() => setUtsOpen(open => !open)}
            aria-expanded={utsOpen}
          >
            <div className="stat-label">Nilai UTS</div>
            <div className="stat-value">{utsGrade?.nilai ?? '—'}</div>
            <div className="stat-sub">{utsGrade ? 'Klik untuk melihat rincian' : 'Nilai belum tersedia'}</div>
            {utsOpen && utsGrade && (
              <div className="uts-breakdown">
                <div><span>Pilihan ganda</span><strong>{utsGrade.pilihan_ganda}</strong></div>
                <div><span>Esai</span><strong>{utsGrade.esai}</strong></div>
                <div><span>Rata-rata kelas</span><strong>{utsGrade.rata_rata_kelas}</strong></div>
              </div>
            )}
          </button>
        )}
      </div>

      <div className="section-heading-row">
        <p className="section-heading" style={{ margin: 0 }}>Deadline Terdekat</p>
        {profile.is_admin && (
          <button className="btn-sm btn-sm-primary" onClick={onManageDeadlines}>⚙ Kelola Deadline</button>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><p>Memuat…</p></div>
      ) : assignments.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📅</div>
          <p>Tidak ada deadline mendatang</p>
          {profile.is_admin && (
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={onManageDeadlines}>+ Tambah Deadline</button>
          )}
        </div>
      ) : (
        <div className="deadline-list">
          {assignments.map(a => {
            const u = urgency(a.due_date)
            const section = SECTIONS.find(s => s.id === a.section_id)
            const isExp = expanded === a.id
            return (
              <div key={a.id} className={`deadline-item dl-dash-item${isExp ? ' expanded' : ''}`}>
                <div className="deadline-item-row" onClick={() => a.description ? setExpanded(isExp ? null : a.id) : section && onNavigate(section.id)}>
                  <div className={`deadline-dot${u ? ` ${u}` : ''}`} />
                  <div className="deadline-info">
                    <div className="deadline-title">
                      {a.title}
                      {u === 'overdue' && <span className="deadline-overdue-badge">Terlambat</span>}
                    </div>
                    <div className="deadline-meta">
                      {section && <span style={{ marginRight: 8 }}>📚 Sesi {section.id}: {section.short}</span>}
                      {a.description && <span style={{ color: 'var(--muted)', fontSize: 11 }}>{isExp ? '▲ sembunyikan' : '▼ lihat detail'}</span>}
                    </div>
                  </div>
                  <div className={`deadline-date${u ? ` ${u}` : ''}`}>{fmtDate(a.due_date)}</div>
                </div>
                {isExp && a.description && (
                  <div className="dl-dash-desc">{a.description}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
